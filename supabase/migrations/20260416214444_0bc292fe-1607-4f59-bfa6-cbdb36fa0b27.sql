-- 1. Storage bucket for club logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Club logos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'club-logos');

CREATE POLICY "Authed users upload club logo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'club-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Owners update own club logo"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'club-logos' AND auth.uid() = owner);

CREATE POLICY "Owners delete own club logo"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'club-logos' AND auth.uid() = owner);

-- 2. Member count trigger
CREATE OR REPLACE FUNCTION public.bump_club_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.club_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_club_member_count ON public.club_members;
CREATE TRIGGER trg_club_member_count
AFTER INSERT OR DELETE ON public.club_members
FOR EACH ROW EXECUTE FUNCTION public.bump_club_member_count();

-- 3. Allow members of private clubs to read their own club + view fellow members
CREATE POLICY "Members view own private club"
  ON public.clubs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = clubs.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members view fellow members"
  ON public.club_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm2
      WHERE cm2.club_id = club_members.club_id AND cm2.user_id = auth.uid()
    )
  );

-- 4. Global leaderboard (monthly KM + all-time + completed challenges)
CREATE OR REPLACE FUNCTION public.global_leaderboard(
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  city text,
  km_this_month numeric,
  km_all_time numeric,
  challenges_completed int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH monthly AS (
    SELECT user_id, SUM(distance_km)::numeric AS km
    FROM public.activity_logs
    WHERE activity_date >= date_trunc('month', current_date)
    GROUP BY user_id
  ),
  alltime AS (
    SELECT user_id, SUM(distance_km)::numeric AS km
    FROM public.activity_logs
    GROUP BY user_id
  ),
  completed AS (
    SELECT user_id, COUNT(*)::int AS n
    FROM public.registrations
    WHERE status = 'completed'
    GROUP BY user_id
  )
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.city,
    COALESCE(m.km, 0),
    COALESCE(a.km, 0),
    COALESCE(c.n, 0)
  FROM public.profiles p
  LEFT JOIN monthly m ON m.user_id = p.id
  LEFT JOIN alltime a ON a.user_id = p.id
  LEFT JOIN completed c ON c.user_id = p.id
  WHERE COALESCE(a.km, 0) > 0
  ORDER BY COALESCE(m.km, 0) DESC, COALESCE(a.km, 0) DESC
  LIMIT _limit OFFSET _offset
$$;

-- 5. Per-challenge leaderboard
CREATE OR REPLACE FUNCTION public.challenge_leaderboard(
  _challenge_id uuid,
  _limit int DEFAULT 20,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  km_logged numeric,
  pct_complete numeric,
  activity_mode text,
  milestones_unlocked int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ch AS (
    SELECT id, total_distance_km FROM public.challenges WHERE id = _challenge_id
  ),
  ms AS (
    SELECT um.user_id, COUNT(*)::int AS n
    FROM public.user_milestones um
    JOIN public.milestones m ON m.id = um.milestone_id
    WHERE m.challenge_id = _challenge_id
    GROUP BY um.user_id
  )
  SELECT
    r.user_id,
    p.full_name,
    p.avatar_url,
    r.total_km_logged,
    CASE WHEN ch.total_distance_km > 0
      THEN LEAST(100, ROUND(r.total_km_logged / ch.total_distance_km * 100, 1))
      ELSE 0 END,
    COALESCE(r.activity_mode::text, 'any'),
    COALESCE(ms.n, 0)
  FROM public.registrations r
  JOIN ch ON true
  JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN ms ON ms.user_id = r.user_id
  WHERE r.challenge_id = _challenge_id
  ORDER BY r.total_km_logged DESC
  LIMIT _limit OFFSET _offset
$$;

-- 6. Hall of Fame (finished the last milestone of a challenge)
CREATE OR REPLACE FUNCTION public.hall_of_fame(_limit int DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  challenge_id uuid,
  challenge_title text,
  challenge_city text,
  challenge_slug text,
  unlocked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_ms AS (
    SELECT DISTINCT ON (challenge_id) id, challenge_id, sequence_no
    FROM public.milestones
    ORDER BY challenge_id, sequence_no DESC
  )
  SELECT
    um.user_id,
    p.full_name,
    p.avatar_url,
    c.id,
    c.title,
    c.city,
    c.slug,
    um.unlocked_at
  FROM public.user_milestones um
  JOIN last_ms lm ON lm.id = um.milestone_id
  JOIN public.challenges c ON c.id = lm.challenge_id
  JOIN public.profiles p ON p.id = um.user_id
  ORDER BY um.unlocked_at DESC
  LIMIT _limit
$$;