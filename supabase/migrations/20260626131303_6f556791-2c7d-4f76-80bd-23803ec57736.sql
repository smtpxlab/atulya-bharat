-- Fix Strava sync ON CONFLICT inference failure.
-- Replace partial unique index with a plain unique index so ON CONFLICT can
-- infer it reliably under PG 17. NULL strava_activity_id rows (manual logs)
-- remain allowed because PG treats NULLs as distinct by default.

DROP INDEX IF EXISTS public.activity_logs_user_strava_unique;

CREATE UNIQUE INDEX activity_logs_user_strava_unique
  ON public.activity_logs (user_id, strava_activity_id);

CREATE OR REPLACE FUNCTION public.ingest_strava_activity(_user_id uuid, _activity jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_matched boolean := false;
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
    v_matched := true;
    EXIT;
  END LOOP;

  IF NOT v_matched THEN
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
    ON CONFLICT (user_id, strava_activity_id)
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
END $function$;