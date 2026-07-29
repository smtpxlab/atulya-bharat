
-- ============================================================
-- Wave 2/3 audit remediation
-- R-1: case-insensitive activity-type matching in progress engine
-- U-7: admin_challenge_participant_stats uses canonical helper
-- P-5: atomic coupon usage increment RPC
-- R-2: trigger to recompute registrations.total_km_logged on activity changes
-- R-4: expire_registrations acquires per-registration advisory lock
-- ============================================================

-- ---------- R-1: case-insensitive allowed-sport matching ----------

CREATE OR REPLACE FUNCTION public._registration_logged_km(_registration_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_end_ts timestamptz;
  v_mode text;
  v_allowed_lower text[];
  v_total numeric;
BEGIN
  SELECT GREATEST(r.registered_at::date, COALESCE(c.start_at::date, r.registered_at::date)),
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         ),
         COALESCE(r.activity_mode::text, 'any')
    INTO v_start, v_end_ts, v_mode
  FROM public.registrations r
  JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = _registration_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_allowed_lower := CASE v_mode
    WHEN 'run'  THEN ARRAY['run','virtualrun','trailrun']
    WHEN 'walk' THEN ARRAY['walk','hike']
    WHEN 'ride' THEN ARRAY['ride','virtualride','ebikeride','mountainbikeride','gravelride','cycling']
    ELSE NULL
  END;

  SELECT COALESCE(SUM(distance_km), 0)::numeric INTO v_total
  FROM public.activity_logs a
  WHERE a.registration_id = _registration_id
    AND a.activity_date BETWEEN v_start AND LEAST(v_end_ts::date, current_date)
    AND (v_allowed_lower IS NULL
         OR lower(COALESCE(a.sport_type, a.activity_type)) = ANY(v_allowed_lower));
  RETURN v_total;
END $$;

CREATE OR REPLACE FUNCTION public.challenge_progress_by_registration(_registration_id uuid)
RETURNS TABLE(registration_id uuid, challenge_id uuid, user_id uuid, distance_target_km numeric, distance_logged_km numeric, distance_remaining_km numeric, pct_complete numeric, activities_count integer, milestones_total integer, milestones_unlocked integer, is_complete boolean, window_start date, window_end date, registered_at timestamp with time zone, activity_mode text, first_activity_date date, last_activity_date date, days_left integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target numeric := 0;
  v_start date; v_end date; v_end_ts timestamptz;
  v_reg_at timestamptz; v_mode text := 'any';
  v_user uuid; v_chal uuid; v_allowed_lower text[];
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
  v_allowed_lower := CASE v_mode
    WHEN 'run'  THEN ARRAY['run','virtualrun','trailrun']
    WHEN 'walk' THEN ARRAY['walk','hike']
    WHEN 'ride' THEN ARRAY['ride','virtualride','ebikeride','mountainbikeride','gravelride','cycling']
    ELSE NULL
  END;
  v_days := LEAST(9999, GREATEST(0, (v_end_ts::date - current_date)))::int;
  RETURN QUERY
  WITH acts AS (
    SELECT a.distance_km, a.activity_date, a.start_date
    FROM public.activity_logs a
    WHERE a.registration_id = _registration_id
      AND a.activity_date BETWEEN v_start AND v_end
      AND (v_allowed_lower IS NULL
           OR lower(COALESCE(a.sport_type, a.activity_type)) = ANY(v_allowed_lower))
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
END $$;

-- Also update Strava ingest to use case-insensitive sport gating
CREATE OR REPLACE FUNCTION public.ingest_strava_activity(_user_id uuid, _activity jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_strava_id bigint := (_activity->>'id')::bigint;
  v_distance_m numeric := COALESCE((_activity->>'distance')::numeric, 0);
  v_distance_km numeric := round(v_distance_m / 1000.0, 3);
  v_sport text := COALESCE(_activity->>'sport_type', _activity->>'type', '');
  v_start_iso text := COALESCE(_activity->>'start_date_local', _activity->>'start_date');
  v_start timestamptz; v_activity_date date;
  v_moving int := COALESCE((_activity->>'moving_time')::int, 0);
  v_elapsed int := COALESCE((_activity->>'elapsed_time')::int, 0);
  v_avg_speed numeric := NULLIF(_activity->>'average_speed','')::numeric;
  v_name text := NULLIF(_activity->>'name','');
  v_polyline text := _activity#>>'{map,summary_polyline}';
  v_activity_type text;
  v_allowed_lower text[]; v_reg record; v_target numeric;
  v_window_start timestamptz; v_window_end timestamptz;
  v_log_id uuid; v_new_total numeric;
  v_inserted boolean := false; v_completed boolean := false;
  v_milestones_unlocked int := 0; v_window_match_seen boolean := false;
  v_existing_manual_id uuid; v_merged boolean := false;
BEGIN
  IF v_strava_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_strava_id'); END IF;
  IF v_start_iso IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_start_date'); END IF;
  v_start := v_start_iso::timestamptz;
  v_activity_date := v_start::date;
  v_activity_type := CASE
    WHEN lower(v_sport) LIKE '%ride%' OR lower(v_sport) LIKE '%cycling%' THEN 'ride'
    WHEN lower(v_sport) LIKE '%walk%' OR lower(v_sport) LIKE '%hike%' THEN 'walk'
    ELSE 'run'
  END;

  FOR v_reg IN
    SELECT r.id, r.challenge_id, r.status, r.activity_mode::text AS mode, r.registered_at,
           LEAST(
             COALESCE(c.end_at, 'infinity'::timestamptz),
             COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
             COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
           ) AS window_end,
           c.distance AS target
    FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
    WHERE r.user_id = _user_id AND r.status IN ('active','completed')
    ORDER BY (r.status = 'active') DESC, r.registered_at DESC
  LOOP
    v_window_start := v_reg.registered_at;
    v_window_end := v_reg.window_end;
    IF v_start < v_window_start OR v_start > v_window_end THEN CONTINUE; END IF;
    v_window_match_seen := true;
    v_allowed_lower := CASE v_reg.mode
      WHEN 'run'  THEN ARRAY['run','virtualrun','trailrun']
      WHEN 'walk' THEN ARRAY['walk','hike']
      WHEN 'ride' THEN ARRAY['ride','virtualride','ebikeride','mountainbikeride','gravelride','cycling']
      ELSE NULL
    END;
    IF v_allowed_lower IS NOT NULL AND NOT (lower(v_sport) = ANY(v_allowed_lower)) THEN CONTINUE; END IF;
    v_target := v_reg.target;
    EXIT;
  END LOOP;

  IF v_reg IS NULL OR v_reg.id IS NULL THEN
    RETURN jsonb_build_object('ok', false,
      'reason', CASE WHEN v_window_match_seen THEN 'wrong_sport_type' ELSE 'no_active_window' END);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || v_reg.id::text));

  SELECT id INTO v_existing_manual_id
  FROM public.activity_logs
  WHERE registration_id = v_reg.id AND source = 'manual' AND strava_activity_id IS NULL
    AND activity_date = v_activity_date AND abs(distance_km - v_distance_km) <= 0.5
  ORDER BY logged_at DESC LIMIT 1;

  IF v_existing_manual_id IS NOT NULL THEN
    UPDATE public.activity_logs SET
      source='strava', distance_km=v_distance_km, activity_type=v_activity_type,
      sport_type=NULLIF(v_sport,''), moving_time_seconds=v_moving, elapsed_time_seconds=v_elapsed,
      average_speed_mps=v_avg_speed, start_date=v_start, polyline=v_polyline,
      strava_activity_id=v_strava_id, raw_payload=_activity, name=COALESCE(v_name, name)
    WHERE id = v_existing_manual_id RETURNING id INTO v_log_id;
    v_merged := true; v_inserted := false;
  ELSE
    INSERT INTO public.activity_logs (
      user_id, registration_id, source, distance_km, activity_date, activity_type,
      sport_type, moving_time_seconds, elapsed_time_seconds, average_speed_mps,
      start_date, polyline, strava_activity_id, raw_payload, name
    ) VALUES (
      _user_id, v_reg.id, 'strava', v_distance_km, v_activity_date, v_activity_type,
      NULLIF(v_sport,''), v_moving, v_elapsed, v_avg_speed,
      v_start, v_polyline, v_strava_id, _activity, v_name
    )
    ON CONFLICT (user_id, strava_activity_id) WHERE strava_activity_id IS NOT NULL
    DO UPDATE SET
      distance_km=EXCLUDED.distance_km, activity_date=EXCLUDED.activity_date,
      activity_type=EXCLUDED.activity_type, sport_type=EXCLUDED.sport_type,
      moving_time_seconds=EXCLUDED.moving_time_seconds, elapsed_time_seconds=EXCLUDED.elapsed_time_seconds,
      average_speed_mps=EXCLUDED.average_speed_mps, start_date=EXCLUDED.start_date,
      polyline=EXCLUDED.polyline, raw_payload=EXCLUDED.raw_payload, name=EXCLUDED.name,
      registration_id=COALESCE(public.activity_logs.registration_id, EXCLUDED.registration_id)
    RETURNING id, (xmax = 0) INTO v_log_id, v_inserted;
  END IF;

  v_new_total := public._registration_logged_km(v_reg.id);

  IF v_target > 0 AND v_new_total >= v_target AND v_reg.status = 'active' THEN
    UPDATE public.registrations
      SET total_km_logged=v_new_total, status='completed',
          completed_at = COALESCE(completed_at, now())
      WHERE id = v_reg.id;
    v_completed := true;
  ELSE
    UPDATE public.registrations SET total_km_logged=v_new_total WHERE id = v_reg.id;
  END IF;

  WITH new_ms AS (
    SELECT cm.id FROM public.challenge_milestones cm
    WHERE cm.challenge_id = v_reg.challenge_id AND cm.distance <= v_new_total
      AND NOT EXISTS (
        SELECT 1 FROM public.user_milestones um
        WHERE um.registration_id = v_reg.id AND um.milestone_id = cm.id
      )
  ), ins AS (
    INSERT INTO public.user_milestones (user_id, milestone_id, registration_id, km_at_unlock)
    SELECT _user_id, id, v_reg.id, v_new_total FROM new_ms
    ON CONFLICT (registration_id, milestone_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_milestones_unlocked FROM ins;

  RETURN jsonb_build_object(
    'ok', true, 'inserted', v_inserted, 'merged', v_merged,
    'registration_id', v_reg.id, 'challenge_id', v_reg.challenge_id,
    'distance_km', v_distance_km, 'total_km_logged', v_new_total,
    'completed', v_completed, 'milestones_unlocked', v_milestones_unlocked
  );
END $$;

-- ---------- U-7: admin participant stats use canonical helper ----------

CREATE OR REPLACE FUNCTION public.admin_challenge_participant_stats(_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE r.status='active'),
    'completed', COUNT(*) FILTER (WHERE r.status='completed'),
    'cancelled', COUNT(*) FILTER (WHERE r.status='cancelled'),
    'expired', COUNT(*) FILTER (WHERE r.status='expired'),
    'total_distance_km', ROUND(COALESCE(SUM(public._registration_logged_km(r.id)), 0), 2),
    'completion_rate',
      CASE WHEN COUNT(*) > 0
           THEN ROUND(COUNT(*) FILTER (WHERE r.status='completed')::numeric / COUNT(*) * 100, 1)
           ELSE 0 END
  ) INTO v
  FROM public.registrations r
  WHERE r.challenge_id = _challenge_id;
  RETURN v;
END $$;

-- ---------- P-5: atomic coupon usage increment ----------

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_used int; v_freq int;
BEGIN
  IF _code IS NULL OR btrim(_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_code');
  END IF;
  UPDATE public.coupons
     SET coupon_used = coupon_used + 1
   WHERE id = (
     SELECT id FROM public.coupons
     WHERE coupon_name ILIKE _code
       AND status = true
       AND (expires_at IS NULL OR expires_at >= now())
       AND (coupon_frequency = 0 OR coupon_used < coupon_frequency)
     LIMIT 1
   )
   RETURNING id, coupon_used, coupon_frequency INTO v_id, v_used, v_freq;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_available');
  END IF;
  RETURN jsonb_build_object('ok', true, 'coupon_id', v_id, 'coupon_used', v_used, 'coupon_frequency', v_freq);
END $$;

REVOKE ALL ON FUNCTION public.increment_coupon_usage(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(text) TO service_role;

-- ---------- R-2: keep registrations.total_km_logged in sync ----------

CREATE OR REPLACE FUNCTION public.activity_logs_sync_registration_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reg uuid;
  v_total numeric;
  v_target numeric;
  v_status registration_status;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_reg := OLD.registration_id;
  ELSE
    v_reg := NEW.registration_id;
  END IF;

  IF v_reg IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_total := public._registration_logged_km(v_reg);

  SELECT c.distance, r.status INTO v_target, v_status
  FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = v_reg;

  -- Only update the denormalized total; do not change status from this path
  -- except auto-complete when an active registration crosses target.
  IF v_target > 0 AND v_total >= v_target AND v_status = 'active' THEN
    UPDATE public.registrations
       SET total_km_logged = v_total,
           status = 'completed',
           completed_at = COALESCE(completed_at, now())
     WHERE id = v_reg;
  ELSE
    UPDATE public.registrations
       SET total_km_logged = v_total
     WHERE id = v_reg AND COALESCE(total_km_logged, -1) IS DISTINCT FROM v_total;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_activity_logs_sync_total ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_sync_total
AFTER INSERT OR UPDATE OF distance_km, activity_date, sport_type, activity_type, registration_id
OR DELETE
ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION public.activity_logs_sync_registration_total();

-- ---------- R-4: expire_registrations acquires advisory lock per row ----------

CREATE OR REPLACE FUNCTION public.expire_registrations(_user_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n int := 0; r record;
BEGIN
  FOR r IN
    SELECT reg.id
    FROM public.registrations reg
    LEFT JOIN public.challenges c ON c.id = reg.challenge_id
    WHERE reg.status = 'active'
      AND (_user_id IS NULL OR reg.user_id = _user_id)
      AND (
        (c.end_at IS NOT NULL AND c.end_at < now())
        OR (reg.target_days IS NOT NULL AND reg.registered_at + (reg.target_days || ' days')::interval < now())
        OR (c.max_duration_days IS NOT NULL AND reg.registered_at + (c.max_duration_days || ' days')::interval < now())
      )
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || r.id::text));
    UPDATE public.registrations
       SET status = 'expired'
     WHERE id = r.id AND status = 'active';
    IF FOUND THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;
