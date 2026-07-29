
CREATE OR REPLACE FUNCTION public.challenge_progress(_user_id uuid, _challenge_id uuid)
RETURNS TABLE (
  distance_target_km numeric,
  distance_logged_km numeric,
  distance_remaining_km numeric,
  pct_complete numeric,
  activities_count integer,
  milestones_total integer,
  milestones_unlocked integer,
  is_complete boolean,
  window_start date,
  window_end date,
  registered_at timestamptz,
  activity_mode text,
  first_activity_date date,
  last_activity_date date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target numeric := 0;
  v_start date;
  v_end date;
  v_reg_at timestamptz;
  v_mode text := 'any';
  v_allowed text[];
BEGIN
  SELECT c.distance,
         GREATEST(COALESCE(r.registered_at::date, c.start_at::date, current_date),
                  COALESCE(c.start_at::date, r.registered_at::date, current_date)),
         LEAST(COALESCE(c.end_at::date, current_date), current_date),
         r.registered_at,
         COALESCE(r.activity_mode::text, 'any')
    INTO v_target, v_start, v_end, v_reg_at, v_mode
  FROM public.challenges c
  LEFT JOIN public.registrations r
    ON r.challenge_id = c.id AND r.user_id = _user_id
  WHERE c.id = _challenge_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

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
    WHERE a.user_id = _user_id
      AND a.activity_date BETWEEN v_start AND v_end
      AND (
        v_allowed IS NULL
        OR COALESCE(a.sport_type, a.activity_type) = ANY(v_allowed)
      )
  ),
  agg AS (
    SELECT COALESCE(SUM(distance_km),0)::numeric AS km,
           COUNT(*)::int AS n,
           MIN(activity_date) AS first_d,
           MAX(activity_date) AS last_d
    FROM acts
  ),
  ms AS (
    SELECT COUNT(*)::int AS total FROM public.challenge_milestones WHERE challenge_id = _challenge_id
  ),
  ums AS (
    SELECT COUNT(*)::int AS unlocked
    FROM public.user_milestones um
    JOIN public.challenge_milestones cm ON cm.id = um.milestone_id
    WHERE um.user_id = _user_id AND cm.challenge_id = _challenge_id
  )
  SELECT
    COALESCE(v_target,0)::numeric,
    ROUND(agg.km, 3),
    GREATEST(0, ROUND(COALESCE(v_target,0) - agg.km, 3)),
    CASE WHEN COALESCE(v_target,0) > 0
         THEN LEAST(100, ROUND(agg.km / v_target * 100, 1))
         ELSE 0 END,
    agg.n,
    ms.total,
    ums.unlocked,
    (agg.km >= COALESCE(v_target,0) AND COALESCE(v_target,0) > 0),
    v_start,
    v_end,
    v_reg_at,
    v_mode,
    agg.first_d,
    agg.last_d
  FROM agg, ms, ums;
END;
$$;

GRANT EXECUTE ON FUNCTION public.challenge_progress(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_progress(uuid, uuid) TO service_role;
