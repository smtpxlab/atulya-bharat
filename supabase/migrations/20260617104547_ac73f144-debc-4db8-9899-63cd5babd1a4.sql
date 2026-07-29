
DROP FUNCTION IF EXISTS public.challenge_leaderboard(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.hall_of_fame(integer);
DROP FUNCTION IF EXISTS public.global_leaderboard(integer, integer);

-- Drop policies that depend on columns we'll remove
DROP POLICY IF EXISTS "Active challenges viewable by everyone" ON public.challenges;

ALTER TABLE public.challenges RENAME COLUMN title TO name;
ALTER TABLE public.challenges RENAME COLUMN total_distance_km TO distance;

ALTER TABLE public.challenges
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS description_short,
  DROP COLUMN IF EXISTS description_long,
  DROP COLUMN IF EXISTS activity_modes,
  DROP COLUMN IF EXISTS is_featured,
  DROP COLUMN IF EXISTS is_new,
  DROP COLUMN IF EXISTS sort_order,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS route_map_image_url;

ALTER TABLE public.challenges
  ADD COLUMN challenge_type text NOT NULL DEFAULT 'Any',
  ADD COLUMN category text NOT NULL DEFAULT 'New',
  ADD COLUMN theme text,
  ADD COLUMN about_map_image_url text,
  ADD COLUMN creative_image_url text,
  ADD COLUMN certificate_image_url text,
  ADD COLUMN bib_image_url text,
  ADD COLUMN route_map_image_url text,
  ADD COLUMN max_duration_days integer,
  ADD COLUMN start_at timestamptz,
  ADD COLUMN end_at timestamptz,
  ADD COLUMN description text,
  ADD COLUMN status boolean NOT NULL DEFAULT true,
  ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_type_check CHECK (challenge_type IN ('Any','Ride','Run/Walk')),
  ADD CONSTRAINT challenges_category_check CHECK (category IN ('New','Featured','Popular','Best Seller')),
  ADD CONSTRAINT challenges_end_after_start CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at);

CREATE POLICY "Active challenges viewable by everyone"
  ON public.challenges FOR SELECT USING (status = true);

DROP INDEX IF EXISTS public.idx_challenges_active;
CREATE INDEX IF NOT EXISTS idx_challenges_slug ON public.challenges(slug);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON public.challenges(category);
CREATE INDEX IF NOT EXISTS idx_challenges_type ON public.challenges(challenge_type);
CREATE INDEX IF NOT EXISTS idx_challenges_start_at ON public.challenges(start_at);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON public.challenges(created_at DESC);

DROP TRIGGER IF EXISTS update_challenges_updated_at ON public.challenges;
CREATE TRIGGER update_challenges_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.challenge_tickets
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS price_inr,
  DROP COLUMN IF EXISTS includes,
  DROP COLUMN IF EXISTS includes_medal,
  DROP COLUMN IF EXISTS sort_order;

ALTER TABLE public.challenge_tickets
  ADD COLUMN ticket_name text NOT NULL DEFAULT '',
  ADD COLUMN ticket_price numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN ticket_inclusions text,
  ADD COLUMN shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN allow_certificate boolean NOT NULL DEFAULT false;

ALTER TABLE public.challenge_tickets ALTER COLUMN ticket_name DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.challenge_leaderboard(_challenge_id uuid, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, km_logged numeric, pct_complete numeric, activity_mode text, milestones_unlocked integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH ch AS (SELECT id, distance FROM public.challenges WHERE id = _challenge_id),
  ms AS (
    SELECT um.user_id, COUNT(*)::int AS n FROM public.user_milestones um
    JOIN public.milestones m ON m.id = um.milestone_id
    WHERE m.challenge_id = _challenge_id GROUP BY um.user_id
  )
  SELECT r.user_id, p.full_name, p.avatar_url, r.total_km_logged,
    CASE WHEN ch.distance > 0 THEN LEAST(100, ROUND(r.total_km_logged / ch.distance * 100, 1)) ELSE 0 END,
    COALESCE(r.activity_mode::text, 'any'), COALESCE(ms.n, 0)
  FROM public.registrations r JOIN ch ON true
  JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN ms ON ms.user_id = r.user_id
  WHERE r.challenge_id = _challenge_id
  ORDER BY r.total_km_logged DESC LIMIT _limit OFFSET _offset
$function$;

CREATE OR REPLACE FUNCTION public.hall_of_fame(_limit integer DEFAULT 50)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, challenge_id uuid, challenge_name text, challenge_slug text, unlocked_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH last_ms AS (
    SELECT DISTINCT ON (challenge_id) id, challenge_id, sequence_no
    FROM public.milestones ORDER BY challenge_id, sequence_no DESC
  )
  SELECT um.user_id, p.full_name, p.avatar_url, c.id, c.name, c.slug, um.unlocked_at
  FROM public.user_milestones um
  JOIN last_ms lm ON lm.id = um.milestone_id
  JOIN public.challenges c ON c.id = lm.challenge_id
  JOIN public.profiles p ON p.id = um.user_id
  ORDER BY um.unlocked_at DESC LIMIT _limit
$function$;

CREATE OR REPLACE FUNCTION public.global_leaderboard(_limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, city text, km_this_month numeric, km_all_time numeric, challenges_completed integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH monthly AS (
    SELECT user_id, SUM(distance_km)::numeric AS km FROM public.activity_logs
    WHERE activity_date >= date_trunc('month', current_date) GROUP BY user_id
  ),
  alltime AS (SELECT user_id, SUM(distance_km)::numeric AS km FROM public.activity_logs GROUP BY user_id),
  completed AS (SELECT user_id, COUNT(*)::int AS n FROM public.registrations WHERE status = 'completed' GROUP BY user_id)
  SELECT p.id, p.full_name, p.avatar_url, p.city,
    COALESCE(m.km, 0), COALESCE(a.km, 0), COALESCE(c.n, 0)
  FROM public.profiles p
  LEFT JOIN monthly m ON m.user_id = p.id
  LEFT JOIN alltime a ON a.user_id = p.id
  LEFT JOIN completed c ON c.user_id = p.id
  WHERE COALESCE(a.km, 0) > 0
  ORDER BY COALESCE(m.km, 0) DESC, COALESCE(a.km, 0) DESC
  LIMIT _limit OFFSET _offset
$function$;

DROP POLICY IF EXISTS "Public read challenge assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins upload challenge assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins update challenge assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete challenge assets" ON storage.objects;

CREATE POLICY "Public read challenge assets" ON storage.objects FOR SELECT USING (bucket_id = 'challenge-assets');
CREATE POLICY "Admins upload challenge assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'challenge-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update challenge assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'challenge-assets' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete challenge assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'challenge-assets' AND public.is_admin(auth.uid()));
