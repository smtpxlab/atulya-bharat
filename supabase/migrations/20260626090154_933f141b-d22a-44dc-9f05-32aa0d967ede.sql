CREATE OR REPLACE FUNCTION public.challenge_progress_by_registration(_registration_id uuid)
 RETURNS TABLE(registration_id uuid, challenge_id uuid, user_id uuid, distance_target_km numeric, distance_logged_km numeric, distance_remaining_km numeric, pct_complete numeric, activities_count integer, milestones_total integer, milestones_unlocked integer, is_complete boolean, window_start date, window_end date, registered_at timestamp with time zone, activity_mode text, first_activity_date date, last_activity_date date, days_left integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target numeric := 0;
  v_start date; v_end date; v_end_ts timestamptz;
  v_reg_at timestamptz; v_mode text := 'any';
  v_user uuid; v_chal uuid; v_allowed text[];
  v_status registration_status;
  v_days int;
BEGIN
  SELECT r.user_id, r.challenge_id, c.distance,
         GREATEST(r.registered_at::date, COALESCE(c.start_at::date, r.registered_at::date)),
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         ),
         r.registered_at, COALESCE(r.activity_mode::text, 'any'), r.status
    INTO v_user, v_chal, v_target, v_start, v_end_ts, v_reg_at, v_mode, v_status
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
  v_days := LEAST(9999, GREATEST(0, (v_end_ts::date - current_date)))::int;
  RETURN QUERY
  WITH acts AS (
    SELECT a.distance_km, a.activity_date, a.start_date
    FROM public.activity_logs a
    WHERE a.registration_id = _registration_id
      AND a.activity_date BETWEEN v_start AND v_end
      AND (v_allowed IS NULL OR COALESCE(a.sport_type, a.activity_type) = ANY(v_allowed))
  ),
  agg AS (
    SELECT COALESCE(SUM(acts.distance_km),0)::numeric AS km,
           COUNT(*)::int AS n,
           MIN(acts.activity_date) AS first_d,
           GREATEST(MAX(acts.activity_date), COALESCE(MAX(acts.start_date)::date, '-infinity'::date)) AS last_d
    FROM acts
  ),
  ms AS (
    SELECT COUNT(*)::int AS total
    FROM public.challenge_milestones cm
    WHERE cm.challenge_id = v_chal
  ),
  ums AS (
    SELECT COUNT(*)::int AS unlocked
    FROM public.user_milestones um
    JOIN public.challenge_milestones cm ON cm.id = um.milestone_id
    WHERE um.registration_id = _registration_id
  )
  SELECT _registration_id, v_chal, v_user,
    COALESCE(v_target,0)::numeric,
    ROUND(LEAST(agg.km, COALESCE(v_target, agg.km)), 3),
    GREATEST(0, ROUND(COALESCE(v_target,0) - agg.km, 3)),
    CASE WHEN COALESCE(v_target,0) > 0 THEN LEAST(100, ROUND(agg.km / v_target * 100, 1)) ELSE 0 END,
    agg.n, ms.total, ums.unlocked,
    (agg.km >= COALESCE(v_target,0) AND COALESCE(v_target,0) > 0 AND v_status IN ('active','completed')),
    v_start, v_end, v_reg_at, v_mode,
    agg.first_d, NULLIF(agg.last_d, '-infinity'::date),
    v_days
  FROM agg, ms, ums;
END $function$;

REVOKE EXECUTE ON FUNCTION public.challenge_progress_by_registration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_progress_by_registration(uuid) TO authenticated, service_role;