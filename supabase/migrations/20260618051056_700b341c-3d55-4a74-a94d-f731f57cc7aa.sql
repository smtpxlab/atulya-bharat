
-- 1. Backfill nulls before NOT NULL
UPDATE public.milestones SET description = '' WHERE description IS NULL;

-- 2. Drop old policies (will recreate after rename)
DROP POLICY IF EXISTS "Admins manage milestones" ON public.milestones;
DROP POLICY IF EXISTS "Milestones viewable by everyone" ON public.milestones;

-- 3. Drop dependent function (will recreate)
DROP FUNCTION IF EXISTS public.hall_of_fame(integer);

-- 4. Rename table
ALTER TABLE public.milestones RENAME TO challenge_milestones;

-- 5. Drop unique (sequence_no scope changes; sort_order is no longer unique)
ALTER TABLE public.challenge_milestones
  DROP CONSTRAINT IF EXISTS milestones_challenge_id_sequence_no_key;

-- 6. Rename columns
ALTER TABLE public.challenge_milestones RENAME COLUMN title TO spot_name;
ALTER TABLE public.challenge_milestones RENAME COLUMN unlock_at_km TO distance;
ALTER TABLE public.challenge_milestones RENAME COLUMN sequence_no TO sort_order;

-- 7. Make sort_order nullable (spec: integer null)
ALTER TABLE public.challenge_milestones ALTER COLUMN sort_order DROP NOT NULL;

-- 8. NOT NULL on description, drop old optional cols
ALTER TABLE public.challenge_milestones ALTER COLUMN description SET NOT NULL;
ALTER TABLE public.challenge_milestones DROP COLUMN landmark_name;
ALTER TABLE public.challenge_milestones DROP COLUMN fun_fact;

-- 9. Add new columns
ALTER TABLE public.challenge_milestones ADD COLUMN spot_image_url text NULL;
ALTER TABLE public.challenge_milestones ADD COLUMN audio_url text NULL;
ALTER TABLE public.challenge_milestones ADD COLUMN status boolean NOT NULL DEFAULT true;
ALTER TABLE public.challenge_milestones ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- 10. Force distance precision (numeric 10,2)
ALTER TABLE public.challenge_milestones ALTER COLUMN distance TYPE numeric(10,2);

-- 11. Distance >= 0 check
ALTER TABLE public.challenge_milestones
  ADD CONSTRAINT challenge_milestones_distance_nonneg CHECK (distance >= 0);

-- 12. Drop old index, create new ones
DROP INDEX IF EXISTS public.idx_milestones_challenge;
CREATE INDEX IF NOT EXISTS idx_challenge_milestones_challenge_id
  ON public.challenge_milestones (challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_milestones_status
  ON public.challenge_milestones (status);

-- 13. Grants
GRANT SELECT ON public.challenge_milestones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.challenge_milestones TO authenticated;
GRANT ALL ON public.challenge_milestones TO service_role;

-- 14. Enable RLS (already enabled but safe) + new policies
ALTER TABLE public.challenge_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enabled milestones viewable by everyone"
  ON public.challenge_milestones FOR SELECT
  USING (status = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage challenge_milestones"
  ON public.challenge_milestones FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 15. updated_at trigger
DROP TRIGGER IF EXISTS update_challenge_milestones_updated_at ON public.challenge_milestones;
CREATE TRIGGER update_challenge_milestones_updated_at
  BEFORE UPDATE ON public.challenge_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. Recreate hall_of_fame() using renamed table + sort_order
CREATE OR REPLACE FUNCTION public.hall_of_fame(_limit integer DEFAULT 50)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, challenge_id uuid, challenge_name text, challenge_slug text, unlocked_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH last_ms AS (
    SELECT DISTINCT ON (challenge_id) id, challenge_id, sort_order
    FROM public.challenge_milestones
    ORDER BY challenge_id, sort_order DESC NULLS LAST
  )
  SELECT um.user_id, p.full_name, p.avatar_url, c.id, c.name, c.slug, um.unlocked_at
  FROM public.user_milestones um
  JOIN last_ms lm ON lm.id = um.milestone_id
  JOIN public.challenges c ON c.id = lm.challenge_id
  JOIN public.profiles p ON p.id = um.user_id
  ORDER BY um.unlocked_at DESC LIMIT _limit
$function$;
