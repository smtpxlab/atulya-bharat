
-- Drop legacy uniqueness so users can re-register after expiry/completion
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_user_id_challenge_id_key;

-- Dedupe: keep most recent active row per user
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY registered_at DESC, id DESC) AS rn
  FROM public.registrations WHERE status = 'active'
)
UPDATE public.registrations r SET status = 'expired'
  FROM ranked WHERE r.id = ranked.id AND ranked.rn > 1;

-- One active registration per user
DROP INDEX IF EXISTS public.registrations_one_active_per_user;
CREATE UNIQUE INDEX registrations_one_active_per_user
  ON public.registrations (user_id) WHERE status = 'active';

-- Prevent duplicate Strava activity in same registration
DROP INDEX IF EXISTS public.activity_logs_strava_per_reg_uniq;
CREATE UNIQUE INDEX activity_logs_strava_per_reg_uniq
  ON public.activity_logs (registration_id, strava_activity_id)
  WHERE strava_activity_id IS NOT NULL AND registration_id IS NOT NULL;

-- Non-negative guards
CREATE OR REPLACE FUNCTION public.guard_non_negative_distance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'activity_logs' AND NEW.distance_km < 0 THEN
    RAISE EXCEPTION 'distance_km must be >= 0';
  END IF;
  IF TG_TABLE_NAME = 'registrations' AND NEW.total_km_logged < 0 THEN
    RAISE EXCEPTION 'total_km_logged must be >= 0';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activity_logs_nonneg ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_nonneg BEFORE INSERT OR UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.guard_non_negative_distance();
DROP TRIGGER IF EXISTS trg_registrations_nonneg ON public.registrations;
CREATE TRIGGER trg_registrations_nonneg BEFORE INSERT OR UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_non_negative_distance();

-- Auto-expire stale active registrations
CREATE OR REPLACE FUNCTION public.expire_registrations(_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0;
BEGIN
  WITH stale AS (
    SELECT r.id
    FROM public.registrations r
    LEFT JOIN public.challenges c ON c.id = r.challenge_id
    WHERE r.status = 'active'
      AND (_user_id IS NULL OR r.user_id = _user_id)
      AND (
        (c.end_at IS NOT NULL AND c.end_at < now())
        OR (r.target_days IS NOT NULL AND r.registered_at + (r.target_days || ' days')::interval < now())
        OR (c.max_duration_days IS NOT NULL AND r.registered_at + (c.max_duration_days || ' days')::interval < now())
      )
  )
  UPDATE public.registrations SET status = 'expired' WHERE id IN (SELECT id FROM stale);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.expire_registrations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_registrations(uuid) TO authenticated, service_role;

-- Active registration lookup
CREATE OR REPLACE FUNCTION public.active_registration(_user_id uuid)
RETURNS TABLE(
  registration_id uuid, challenge_id uuid, challenge_name text, challenge_slug text,
  distance_target_km numeric, activity_mode text, registered_at timestamptz,
  window_end timestamptz, total_km_logged numeric, cover_image_url text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.expire_registrations(_user_id);
  RETURN QUERY
  SELECT r.id, c.id, c.name, c.slug, c.distance,
         COALESCE(r.activity_mode::text, 'any'),
         r.registered_at,
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         ),
         r.total_km_logged, c.cover_image_url
  FROM public.registrations r
  JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.user_id = _user_id AND r.status = 'active'
  LIMIT 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.active_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_registration(uuid) TO authenticated, service_role;

-- Register-for-challenge guard
CREATE OR REPLACE FUNCTION public.register_for_challenge(
  _user_id uuid, _challenge_id uuid, _ticket_id uuid,
  _activity_mode text, _target_days integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing record; v_new_id uuid;
BEGIN
  PERFORM public.expire_registrations(_user_id);
  SELECT r.id, c.name INTO v_existing
  FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.user_id = _user_id AND r.status = 'active' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'active_challenge_exists',
      'registration_id', v_existing.id, 'challenge_name', v_existing.name);
  END IF;
  INSERT INTO public.registrations (
    user_id, challenge_id, ticket_id, activity_mode, target_days,
    status, registered_at, total_km_logged
  ) VALUES (
    _user_id, _challenge_id, _ticket_id,
    COALESCE(_activity_mode, 'any')::activity_mode,
    _target_days, 'active', now(), 0
  ) RETURNING id INTO v_new_id;
  RETURN jsonb_build_object('ok', true, 'registration_id', v_new_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.register_for_challenge(uuid, uuid, uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_for_challenge(uuid, uuid, uuid, text, integer) TO authenticated, service_role;

-- Registration-scoped progress
CREATE OR REPLACE FUNCTION public.challenge_progress_by_registration(_registration_id uuid)
RETURNS TABLE(
  registration_id uuid, challenge_id uuid, user_id uuid,
  distance_target_km numeric, distance_logged_km numeric, distance_remaining_km numeric,
  pct_complete numeric, activities_count integer,
  milestones_total integer, milestones_unlocked integer,
  is_complete boolean, window_start date, window_end date,
  registered_at timestamptz, activity_mode text,
  first_activity_date date, last_activity_date date, days_left integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target numeric := 0;
  v_start date; v_end date; v_end_ts timestamptz;
  v_reg_at timestamptz; v_mode text := 'any';
  v_user uuid; v_chal uuid; v_allowed text[];
BEGIN
  SELECT r.user_id, r.challenge_id, c.distance,
         GREATEST(r.registered_at::date, COALESCE(c.start_at::date, r.registered_at::date)),
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         ),
         r.registered_at, COALESCE(r.activity_mode::text, 'any')
    INTO v_user, v_chal, v_target, v_start, v_end_ts, v_reg_at, v_mode
  FROM public.registrations r
  JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = _registration_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_end := LEAST(v_end_ts::date, current_date);
  v_allowed := CASE v_mode
    WHEN 'run'  THEN ARRAY['Run','VirtualRun','TrailRun']
    WHEN 'walk' THEN ARRAY['Walk','Hike']
    WHEN 'ride' THEN ARRAY['Ride','VirtualRide','EBikeRide','MountainBikeRide','GravelRide']
    ELSE NULL
  END;
  RETURN QUERY
  WITH acts AS (
    SELECT a.distance_km, a.activity_date
    FROM public.activity_logs a
    WHERE a.registration_id = _registration_id
      AND a.activity_date BETWEEN v_start AND v_end
      AND (v_allowed IS NULL OR COALESCE(a.sport_type, a.activity_type) = ANY(v_allowed))
  ),
  agg AS (
    SELECT COALESCE(SUM(distance_km),0)::numeric AS km, COUNT(*)::int AS n,
           MIN(activity_date) AS first_d, MAX(activity_date) AS last_d FROM acts
  ),
  ms AS (SELECT COUNT(*)::int AS total FROM public.challenge_milestones WHERE challenge_id = v_chal),
  ums AS (
    SELECT COUNT(*)::int AS unlocked FROM public.user_milestones um
    JOIN public.challenge_milestones cm ON cm.id = um.milestone_id
    WHERE um.user_id = v_user AND cm.challenge_id = v_chal
  )
  SELECT _registration_id, v_chal, v_user,
    COALESCE(v_target,0)::numeric, ROUND(agg.km, 3),
    GREATEST(0, ROUND(COALESCE(v_target,0) - agg.km, 3)),
    CASE WHEN COALESCE(v_target,0) > 0 THEN LEAST(100, ROUND(agg.km / v_target * 100, 1)) ELSE 0 END,
    agg.n, ms.total, ums.unlocked,
    (agg.km >= COALESCE(v_target,0) AND COALESCE(v_target,0) > 0),
    v_start, v_end, v_reg_at, v_mode,
    agg.first_d, agg.last_d,
    GREATEST(0, (v_end_ts::date - current_date))::int
  FROM agg, ms, ums;
END $$;
REVOKE EXECUTE ON FUNCTION public.challenge_progress_by_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_progress_by_registration(uuid) TO authenticated, service_role;
