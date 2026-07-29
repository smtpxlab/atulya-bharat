
-- 1. list_club_members RPC -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_club_members(_club_id uuid)
RETURNS TABLE(
  membership_id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  is_owner boolean,
  full_name text,
  avatar_url text,
  city text,
  activities_count integer,
  total_distance_km numeric,
  challenges_completed integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_visible boolean;
BEGIN
  SELECT (c.status = 'approved' AND c.is_public = true)
         OR public.is_admin(auth.uid())
         OR public.is_club_member(auth.uid(), c.id)
         OR (c.promoter_id IS NOT NULL AND c.promoter_id = auth.uid())
         OR (c.created_by IS NOT NULL AND c.created_by = auth.uid())
    INTO v_visible
  FROM public.clubs c WHERE c.id = _club_id;
  IF NOT COALESCE(v_visible, false) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH acts AS (
    SELECT a.user_id,
           COUNT(*)::int AS n,
           COALESCE(SUM(a.distance_km),0)::numeric AS km
    FROM public.activity_logs a
    JOIN public.club_members m ON m.user_id = a.user_id
    WHERE m.club_id = _club_id
    GROUP BY a.user_id
  ),
  done AS (
    SELECT r.user_id, COUNT(*)::int AS n
    FROM public.registrations r
    JOIN public.club_members m ON m.user_id = r.user_id
    WHERE m.club_id = _club_id AND r.status = 'completed'
    GROUP BY r.user_id
  )
  SELECT cm.id, cm.user_id, cm.role::text, cm.joined_at,
         (cm.role = 'owner'::club_role) AS is_owner,
         p.full_name, p.avatar_url, p.city,
         COALESCE(acts.n, 0),
         ROUND(COALESCE(acts.km, 0), 2),
         COALESCE(done.n, 0)
  FROM public.club_members cm
  JOIN public.profiles p ON p.id = cm.user_id
  LEFT JOIN acts ON acts.user_id = cm.user_id
  LEFT JOIN done ON done.user_id = cm.user_id
  WHERE cm.club_id = _club_id
  ORDER BY (cm.role = 'owner'::club_role) DESC,
           (cm.role = 'admin'::club_role) DESC,
           cm.joined_at ASC;
END $$;

GRANT EXECUTE ON FUNCTION public.list_club_members(uuid) TO anon, authenticated;

-- 2. recompute_club_member_count ----------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_club_member_count(_club_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int := 0;
BEGIN
  IF _club_id IS NOT NULL AND NOT public.is_admin(auth.uid()) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  WITH counts AS (
    SELECT c.id, COALESCE((SELECT COUNT(*) FROM public.club_members m WHERE m.club_id = c.id), 0)::int AS actual
    FROM public.clubs c
    WHERE _club_id IS NULL OR c.id = _club_id
  )
  UPDATE public.clubs c SET member_count = counts.actual
  FROM counts WHERE c.id = counts.id AND c.member_count <> counts.actual;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

GRANT EXECUTE ON FUNCTION public.recompute_club_member_count(uuid) TO authenticated;

-- 3. Backfill owner rows + auto-seed trigger -----------------------------------
INSERT INTO public.club_members (club_id, user_id, role)
SELECT c.id, COALESCE(c.promoter_id, c.created_by), 'owner'::club_role
FROM public.clubs c
WHERE COALESCE(c.promoter_id, c.created_by) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.club_members m
    WHERE m.club_id = c.id AND m.user_id = COALESCE(c.promoter_id, c.created_by)
  )
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Promote existing membership to owner role where needed
UPDATE public.club_members m
SET role = 'owner'::club_role
FROM public.clubs c
WHERE m.club_id = c.id
  AND m.user_id = COALESCE(c.promoter_id, c.created_by)
  AND COALESCE(c.promoter_id, c.created_by) IS NOT NULL
  AND m.role <> 'owner'::club_role;

CREATE OR REPLACE FUNCTION public.clubs_seed_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  v_owner := COALESCE(NEW.promoter_id, NEW.created_by);
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.club_members (club_id, user_id, role)
    VALUES (NEW.id, v_owner, 'owner'::club_role)
    ON CONFLICT (club_id, user_id) DO UPDATE SET role = 'owner'::club_role;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clubs_seed_owner_member ON public.clubs;
CREATE TRIGGER trg_clubs_seed_owner_member
AFTER INSERT ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.clubs_seed_owner_member();

-- 4. Block deleting the last owner ---------------------------------------------
CREATE OR REPLACE FUNCTION public.club_members_block_last_owner_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_remaining int;
BEGIN
  IF OLD.role = 'owner'::club_role THEN
    SELECT COUNT(*) INTO v_remaining
    FROM public.club_members
    WHERE club_id = OLD.club_id AND role = 'owner'::club_role AND id <> OLD.id;
    IF v_remaining = 0 AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Cannot remove the last owner of this club. Transfer ownership first.'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_club_members_block_last_owner ON public.club_members;
CREATE TRIGGER trg_club_members_block_last_owner
BEFORE DELETE ON public.club_members
FOR EACH ROW EXECUTE FUNCTION public.club_members_block_last_owner_delete();

-- 5. Recompute member counts now ----------------------------------------------
WITH counts AS (
  SELECT c.id, COALESCE((SELECT COUNT(*) FROM public.club_members m WHERE m.club_id = c.id), 0)::int AS actual
  FROM public.clubs c
)
UPDATE public.clubs c SET member_count = counts.actual
FROM counts WHERE c.id = counts.id AND c.member_count <> counts.actual;

-- 6. Admin participants RPCs ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_challenge_participants(
  _challenge_id uuid,
  _search text DEFAULT NULL,
  _status text DEFAULT NULL,
  _limit int DEFAULT 50,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  registration_id uuid,
  user_id uuid,
  full_name text,
  email text,
  avatar_url text,
  booking_number text,
  registered_at timestamptz,
  status text,
  completed_at timestamptz,
  certificate_number text,
  payment_status text,
  order_id uuid,
  amount_paise int,
  activity_mode text,
  distance_target_km numeric,
  distance_logged_km numeric,
  distance_remaining_km numeric,
  pct_complete numeric,
  activities_count integer,
  milestones_total integer,
  milestones_unlocked integer,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT r.*, p.full_name, p.email, p.avatar_url
    FROM public.registrations r
    JOIN public.profiles p ON p.id = r.user_id
    WHERE r.challenge_id = _challenge_id
      AND (_status IS NULL OR _status = 'all' OR r.status::text = _status)
      AND (
        _search IS NULL OR btrim(_search) = '' OR
        p.full_name ILIKE '%'||_search||'%' OR
        p.email ILIKE '%'||_search||'%' OR
        r.bib_number ILIKE '%'||_search||'%'
      )
  ),
  total AS (SELECT COUNT(*)::bigint AS n FROM base),
  page AS (
    SELECT * FROM base ORDER BY registered_at DESC
    LIMIT GREATEST(1, LEAST(_limit, 200)) OFFSET GREATEST(0, _offset)
  ),
  ord AS (
    SELECT DISTINCT ON (o.registration_id)
           o.registration_id, o.id AS order_id, o.booking_number,
           o.payment_status, o.final_amount_paise
    FROM public.orders o
    WHERE o.registration_id IN (SELECT id FROM page)
    ORDER BY o.registration_id, (o.payment_status='paid') DESC, o.created_at DESC
  )
  SELECT
    p.id, p.user_id, p.full_name, p.email, p.avatar_url,
    COALESCE(o.booking_number, p.bib_number),
    p.registered_at, p.status::text, p.completed_at, p.certificate_number,
    COALESCE(o.payment_status, 'unknown'), o.order_id, o.final_amount_paise,
    COALESCE(p.activity_mode::text, 'any'),
    prog.distance_target_km, prog.distance_logged_km, prog.distance_remaining_km,
    prog.pct_complete, prog.activities_count, prog.milestones_total, prog.milestones_unlocked,
    (SELECT n FROM total)
  FROM page p
  LEFT JOIN ord o ON o.registration_id = p.id
  LEFT JOIN LATERAL public.challenge_progress_by_registration(p.id) prog ON true;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_list_challenge_participants(uuid, text, text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_challenge_participant_stats(_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE status='active'),
    'completed', COUNT(*) FILTER (WHERE status='completed'),
    'cancelled', COUNT(*) FILTER (WHERE status='cancelled'),
    'expired', COUNT(*) FILTER (WHERE status='expired'),
    'total_distance_km', ROUND(COALESCE(SUM(total_km_logged), 0), 2),
    'completion_rate',
      CASE WHEN COUNT(*) > 0
           THEN ROUND(COUNT(*) FILTER (WHERE status='completed')::numeric / COUNT(*) * 100, 1)
           ELSE 0 END
  ) INTO v
  FROM public.registrations
  WHERE challenge_id = _challenge_id;
  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_challenge_participant_stats(uuid) TO authenticated;
