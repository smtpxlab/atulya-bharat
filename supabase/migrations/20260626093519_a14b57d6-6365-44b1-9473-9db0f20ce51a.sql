
-- 1. Mode-aware helper: km logged within a registration's window, filtered by its activity_mode
CREATE OR REPLACE FUNCTION public._registration_logged_km(_registration_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mode text; v_start timestamptz; v_end timestamptz; v_allowed text[]; v_km numeric;
BEGIN
  SELECT COALESCE(r.activity_mode::text, 'any'), r.registered_at,
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         )
    INTO v_mode, v_start, v_end
  FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = _registration_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_allowed := CASE v_mode
    WHEN 'run'  THEN ARRAY['Run','VirtualRun','TrailRun']
    WHEN 'walk' THEN ARRAY['Walk','Hike']
    WHEN 'ride' THEN ARRAY['Ride','VirtualRide','EBikeRide','MountainBikeRide','GravelRide']
    ELSE NULL
  END;

  SELECT COALESCE(SUM(a.distance_km), 0)::numeric INTO v_km
  FROM public.activity_logs a
  WHERE a.registration_id = _registration_id
    AND a.activity_date BETWEEN v_start::date AND LEAST(v_end::date, current_date)
    AND (v_allowed IS NULL OR COALESCE(a.sport_type, a.activity_type) = ANY(v_allowed));
  RETURN round(COALESCE(v_km, 0), 3);
END $$;

-- 2. Helper: does an activity_type satisfy a mode?
CREATE OR REPLACE FUNCTION public._activity_type_matches_mode(_activity_type text, _mode text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE COALESCE(_mode,'any')
    WHEN 'any' THEN true
    WHEN 'run'  THEN lower(COALESCE(_activity_type,'')) IN ('run','virtualrun','trailrun')
    WHEN 'walk' THEN lower(COALESCE(_activity_type,'')) IN ('walk','hike')
    WHEN 'ride' THEN lower(COALESCE(_activity_type,'')) IN ('ride','virtualride','ebikeride','mountainbikeride','gravelride','cycling')
    ELSE true
  END
$$;

-- 3. log_manual_activity: enforce mode + use helper for totals
CREATE OR REPLACE FUNCTION public.log_manual_activity(_registration_id uuid, _distance_km numeric, _activity_date date, _activity_type text, _notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reg record;
  v_target numeric;
  v_new_total numeric;
  v_completed boolean := false;
  v_unlocked int := 0;
  v_log_id uuid;
  v_dup_exists boolean;
  v_mode text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Please sign in to log an activity.' USING ERRCODE='42501'; END IF;
  IF _distance_km IS NULL OR _distance_km <= 0 THEN
    RAISE EXCEPTION 'Distance must be greater than 0.' USING ERRCODE='P0001';
  END IF;

  SELECT r.id, r.challenge_id, r.status, c.distance, r.registered_at,
         COALESCE(r.activity_mode::text,'any') AS mode,
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         )::date AS window_end
  INTO v_reg
  FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = _registration_id AND r.user_id = v_user;
  IF v_reg IS NULL THEN RAISE EXCEPTION 'Registration not found.' USING ERRCODE='P0001'; END IF;
  IF v_reg.status = 'completed' THEN RAISE EXCEPTION 'You have already completed this challenge.' USING ERRCODE='P0001'; END IF;
  IF v_reg.status <> 'active' THEN RAISE EXCEPTION 'This challenge is not active.' USING ERRCODE='P0001'; END IF;

  v_mode := v_reg.mode;
  IF NOT public._activity_type_matches_mode(_activity_type, v_mode) THEN
    RAISE EXCEPTION 'This challenge only accepts % activities.', v_mode USING ERRCODE='P0001';
  END IF;

  v_target := v_reg.distance;
  IF _distance_km > v_target THEN
    RAISE EXCEPTION 'A single activity cannot exceed the challenge target of % km.', v_target USING ERRCODE='P0001';
  END IF;
  IF _activity_date < v_reg.registered_at::date OR _activity_date > v_reg.window_end THEN
    RAISE EXCEPTION 'Pick a date between % and %.', v_reg.registered_at::date, v_reg.window_end USING ERRCODE='P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.activity_logs
    WHERE registration_id = v_reg.id
      AND source = 'manual'
      AND activity_date = _activity_date
      AND abs(distance_km - _distance_km) <= 0.05
  ) INTO v_dup_exists;
  IF v_dup_exists THEN
    RAISE EXCEPTION 'You already logged this exact distance for this date.' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || v_reg.id::text));

  INSERT INTO public.activity_logs (
    user_id, registration_id, source, distance_km, activity_date, activity_type, raw_payload
  ) VALUES (
    v_user, v_reg.id, 'manual', _distance_km, _activity_date, _activity_type,
    CASE WHEN _notes IS NOT NULL THEN jsonb_build_object('notes', _notes) ELSE NULL END
  ) RETURNING id INTO v_log_id;

  v_new_total := public._registration_logged_km(v_reg.id);

  IF v_target > 0 AND v_new_total >= v_target THEN
    UPDATE public.registrations
      SET total_km_logged = v_new_total, status='completed',
          completed_at = COALESCE(completed_at, now())
      WHERE id = v_reg.id;
    v_completed := true;
  ELSE
    UPDATE public.registrations SET total_km_logged = v_new_total WHERE id = v_reg.id;
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
    SELECT v_user, id, v_reg.id, v_new_total FROM new_ms RETURNING milestone_id
  )
  SELECT count(*) INTO v_unlocked FROM ins;

  RETURN jsonb_build_object(
    'ok', true, 'log_id', v_log_id, 'registration_id', v_reg.id,
    'total_km_logged', v_new_total, 'completed', v_completed,
    'milestones_unlocked', v_unlocked,
    'newly_unlocked_milestone_ids', (
      SELECT COALESCE(array_agg(um.milestone_id), ARRAY[]::uuid[])
      FROM public.user_milestones um
      WHERE um.registration_id = v_reg.id AND um.km_at_unlock = v_new_total
    )
  );
END $$;

-- 4. ingest_strava_activity: use helper for total + completion check
CREATE OR REPLACE FUNCTION public.ingest_strava_activity(_user_id uuid, _activity jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  v_allowed text[]; v_reg record; v_target numeric;
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
    v_allowed := CASE v_reg.mode
      WHEN 'run'  THEN ARRAY['Run','VirtualRun','TrailRun']
      WHEN 'walk' THEN ARRAY['Walk','Hike']
      WHEN 'ride' THEN ARRAY['Ride','VirtualRide','EBikeRide','MountainBikeRide','GravelRide']
      ELSE NULL
    END;
    IF v_allowed IS NOT NULL AND NOT (v_sport = ANY(v_allowed)) THEN CONTINUE; END IF;
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
    SELECT _user_id, id, v_reg.id, v_new_total FROM new_ms RETURNING 1
  )
  SELECT count(*) INTO v_milestones_unlocked FROM ins;

  RETURN jsonb_build_object(
    'ok', true, 'inserted', v_inserted, 'merged', v_merged,
    'registration_id', v_reg.id, 'challenge_id', v_reg.challenge_id,
    'distance_km', v_distance_km, 'total_km_logged', v_new_total,
    'completed', v_completed, 'milestones_unlocked', v_milestones_unlocked
  );
END $$;

-- 5. delete_strava_activity: use helper for recomputed total
CREATE OR REPLACE FUNCTION public.delete_strava_activity(_user_id uuid, _strava_activity_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_reg uuid; v_new_total numeric; v_target numeric; v_status registration_status;
BEGIN
  SELECT registration_id INTO v_reg FROM public.activity_logs
   WHERE user_id = _user_id AND strava_activity_id = _strava_activity_id;
  IF v_reg IS NULL THEN
    DELETE FROM public.activity_logs
     WHERE user_id = _user_id AND strava_activity_id = _strava_activity_id;
    RETURN jsonb_build_object('ok', true, 'deleted', false);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || v_reg::text));

  DELETE FROM public.activity_logs
   WHERE user_id = _user_id AND strava_activity_id = _strava_activity_id;

  v_new_total := public._registration_logged_km(v_reg);

  SELECT c.distance, r.status INTO v_target, v_status
    FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
    WHERE r.id = v_reg;

  IF v_status = 'completed' AND v_new_total < v_target THEN
    UPDATE public.registrations
      SET total_km_logged = v_new_total, status='active', completed_at = NULL
      WHERE id = v_reg;
  ELSE
    UPDATE public.registrations SET total_km_logged = v_new_total WHERE id = v_reg;
  END IF;

  RETURN jsonb_build_object('ok', true, 'deleted', true, 'registration_id', v_reg, 'total_km_logged', v_new_total);
END $$;

-- 6. admin_force_complete_registration: pick activity_type matching mode
CREATE OR REPLACE FUNCTION public.admin_force_complete_registration(_registration_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_reg record; v_remaining numeric; v_log_id uuid; v_unlocked int := 0;
  v_mode text; v_act_type text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  SELECT r.id, r.user_id, r.challenge_id, r.status, r.total_km_logged,
         COALESCE(r.activity_mode::text,'any') AS mode, c.distance AS target
    INTO v_reg
  FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = _registration_id;
  IF v_reg IS NULL THEN RAISE EXCEPTION 'registration not found' USING ERRCODE='P0001'; END IF;

  v_mode := v_reg.mode;
  v_act_type := CASE v_mode WHEN 'walk' THEN 'Walk' WHEN 'ride' THEN 'Ride' ELSE 'Run' END;

  v_remaining := GREATEST(0, v_reg.target - public._registration_logged_km(v_reg.id));

  PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || v_reg.id::text));

  IF v_remaining > 0 THEN
    INSERT INTO public.activity_logs (
      user_id, registration_id, source, distance_km, activity_date, activity_type, sport_type, raw_payload
    ) VALUES (
      v_reg.user_id, v_reg.id, 'manual', v_remaining, current_date, v_act_type, v_act_type,
      jsonb_build_object('notes', 'Admin force-complete', 'admin', true)
    ) RETURNING id INTO v_log_id;
  END IF;

  UPDATE public.registrations
     SET total_km_logged = GREATEST(v_reg.target, public._registration_logged_km(v_reg.id)),
         status='completed', completed_at = COALESCE(completed_at, now())
   WHERE id = v_reg.id;

  WITH new_ms AS (
    SELECT cm.id FROM public.challenge_milestones cm
    WHERE cm.challenge_id = v_reg.challenge_id AND cm.distance <= v_reg.target
      AND NOT EXISTS (
        SELECT 1 FROM public.user_milestones um
        WHERE um.registration_id = v_reg.id AND um.milestone_id = cm.id
      )
  ), ins AS (
    INSERT INTO public.user_milestones (user_id, milestone_id, registration_id, km_at_unlock)
    SELECT v_reg.user_id, id, v_reg.id, v_reg.target FROM new_ms RETURNING milestone_id
  )
  SELECT count(*) INTO v_unlocked FROM ins;

  RETURN jsonb_build_object('ok', true, 'registration_id', v_reg.id,
                            'log_id', v_log_id, 'added_km', v_remaining,
                            'milestones_unlocked', v_unlocked);
END $$;

-- 7. Backfill: recompute every registration's total and demote stale completions
DO $$
DECLARE r record; v_new numeric; v_target numeric;
BEGIN
  FOR r IN SELECT reg.id, c.distance AS target, reg.status
           FROM public.registrations reg JOIN public.challenges c ON c.id = reg.challenge_id
  LOOP
    v_new := public._registration_logged_km(r.id);
    v_target := r.target;
    IF r.status = 'completed' AND v_new < COALESCE(v_target,0) THEN
      UPDATE public.registrations
        SET total_km_logged = v_new, status='active', completed_at = NULL,
            certificate_number = NULL
        WHERE id = r.id;
    ELSE
      UPDATE public.registrations SET total_km_logged = v_new WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 8. Realtime
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.registrations REPLICA IDENTITY FULL;
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;
