
-- =====================================================================
-- 1. user_notifications table
-- =====================================================================
CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('challenge_completed','milestone_unlocked','strava_reconnect','generic')),
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  icon text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_notifications_user_created_idx
  ON public.user_notifications (user_id, created_at DESC);
CREATE INDEX user_notifications_unread_idx
  ON public.user_notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.user_notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.user_notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
ALTER TABLE public.user_notifications REPLICA IDENTITY FULL;

-- Make sure realtime works on registrations and user_milestones (idempotent).
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_milestones';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.registrations REPLICA IDENTITY FULL;
ALTER TABLE public.user_milestones REPLICA IDENTITY FULL;

-- =====================================================================
-- 2. Notification triggers
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_challenge_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_distance numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    BEGIN
      SELECT name, distance INTO v_name, v_distance
      FROM public.challenges WHERE id = NEW.challenge_id;
      INSERT INTO public.user_notifications (user_id, type, title, body, link_url, icon, metadata)
      VALUES (
        NEW.user_id,
        'challenge_completed',
        'Challenge Completed',
        format('Congratulations! You completed the %s KM %s. Your certificate is ready.',
               COALESCE(v_distance::text,'?'), COALESCE(v_name,'challenge')),
        '/my-challenges/' || NEW.id::text,
        'trophy',
        jsonb_build_object(
          'registration_id', NEW.id,
          'challenge_id', NEW.challenge_id,
          'distance', v_distance,
          'completed_at', NEW.completed_at
        )
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_registrations_notify_complete ON public.registrations;
CREATE TRIGGER tr_registrations_notify_complete
  AFTER UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_challenge_completed();

CREATE OR REPLACE FUNCTION public.notify_milestone_unlocked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_spot text; v_dist numeric; v_chal uuid;
BEGIN
  BEGIN
    SELECT spot_name, distance, challenge_id INTO v_spot, v_dist, v_chal
    FROM public.challenge_milestones WHERE id = NEW.milestone_id;
    INSERT INTO public.user_notifications (user_id, type, title, body, link_url, icon, metadata)
    VALUES (
      NEW.user_id,
      'milestone_unlocked',
      'Milestone Unlocked',
      format('%s KM Badge earned — %s', COALESCE(v_dist::text,'?'), COALESCE(v_spot,'milestone')),
      CASE WHEN NEW.registration_id IS NOT NULL
           THEN '/my-challenges/' || NEW.registration_id::text
           ELSE NULL END,
      'mountain',
      jsonb_build_object(
        'milestone_id', NEW.milestone_id,
        'registration_id', NEW.registration_id,
        'challenge_id', v_chal,
        'spot_name', v_spot,
        'distance', v_dist,
        'km_at_unlock', NEW.km_at_unlock
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_user_milestones_notify ON public.user_milestones;
CREATE TRIGGER tr_user_milestones_notify
  AFTER INSERT ON public.user_milestones
  FOR EACH ROW EXECUTE FUNCTION public.notify_milestone_unlocked();

-- =====================================================================
-- 3. ingest_strava_activity — distinct skip reasons + manual dedup merge
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ingest_strava_activity(_user_id uuid, _activity jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_strava_id bigint := (_activity->>'id')::bigint;
  v_distance_m numeric := COALESCE((_activity->>'distance')::numeric, 0);
  v_distance_km numeric := round(v_distance_m / 1000.0, 3);
  v_sport text := COALESCE(_activity->>'sport_type', _activity->>'type', '');
  v_start_iso text := COALESCE(_activity->>'start_date_local', _activity->>'start_date');
  v_start timestamptz;
  v_activity_date date;
  v_moving int := COALESCE((_activity->>'moving_time')::int, 0);
  v_elapsed int := COALESCE((_activity->>'elapsed_time')::int, 0);
  v_avg_speed numeric := NULLIF(_activity->>'average_speed','')::numeric;
  v_name text := NULLIF(_activity->>'name','');
  v_polyline text := _activity#>>'{map,summary_polyline}';
  v_activity_type text;
  v_allowed text[];
  v_reg record;
  v_target numeric;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_log_id uuid;
  v_new_total numeric;
  v_inserted boolean := false;
  v_completed boolean := false;
  v_milestones_unlocked int := 0;
  v_window_match_seen boolean := false;
  v_existing_manual_id uuid;
  v_merged boolean := false;
BEGIN
  IF v_strava_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_strava_id');
  END IF;
  IF v_start_iso IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_start_date');
  END IF;
  v_start := v_start_iso::timestamptz;
  v_activity_date := v_start::date;

  v_activity_type := CASE
    WHEN lower(v_sport) LIKE '%ride%' OR lower(v_sport) LIKE '%cycling%' THEN 'ride'
    WHEN lower(v_sport) LIKE '%walk%' OR lower(v_sport) LIKE '%hike%' THEN 'walk'
    ELSE 'run'
  END;

  FOR v_reg IN
    SELECT r.id, r.challenge_id, r.status, r.activity_mode::text AS mode,
           r.registered_at,
           LEAST(
             COALESCE(c.end_at, 'infinity'::timestamptz),
             COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
             COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
           ) AS window_end,
           c.distance AS target
    FROM public.registrations r
    JOIN public.challenges c ON c.id = r.challenge_id
    WHERE r.user_id = _user_id
      AND r.status IN ('active', 'completed')
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
    RETURN jsonb_build_object(
      'ok', false,
      'reason', CASE WHEN v_window_match_seen THEN 'wrong_sport_type' ELSE 'no_active_window' END
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || v_reg.id::text));

  -- Dedup: if a manual log exists on the same day with similar distance, merge into it.
  SELECT id INTO v_existing_manual_id
  FROM public.activity_logs
  WHERE registration_id = v_reg.id
    AND source = 'manual'
    AND strava_activity_id IS NULL
    AND activity_date = v_activity_date
    AND abs(distance_km - v_distance_km) <= 0.5
  ORDER BY logged_at DESC LIMIT 1;

  IF v_existing_manual_id IS NOT NULL THEN
    UPDATE public.activity_logs SET
      source = 'strava',
      distance_km = v_distance_km,
      activity_type = v_activity_type,
      sport_type = NULLIF(v_sport,''),
      moving_time_seconds = v_moving,
      elapsed_time_seconds = v_elapsed,
      average_speed_mps = v_avg_speed,
      start_date = v_start,
      polyline = v_polyline,
      strava_activity_id = v_strava_id,
      raw_payload = _activity,
      name = COALESCE(v_name, name)
    WHERE id = v_existing_manual_id
    RETURNING id INTO v_log_id;
    v_merged := true;
    v_inserted := false;
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
      distance_km = EXCLUDED.distance_km,
      activity_date = EXCLUDED.activity_date,
      activity_type = EXCLUDED.activity_type,
      sport_type = EXCLUDED.sport_type,
      moving_time_seconds = EXCLUDED.moving_time_seconds,
      elapsed_time_seconds = EXCLUDED.elapsed_time_seconds,
      average_speed_mps = EXCLUDED.average_speed_mps,
      start_date = EXCLUDED.start_date,
      polyline = EXCLUDED.polyline,
      raw_payload = EXCLUDED.raw_payload,
      name = EXCLUDED.name,
      registration_id = COALESCE(public.activity_logs.registration_id, EXCLUDED.registration_id)
    RETURNING id, (xmax = 0) INTO v_log_id, v_inserted;
  END IF;

  SELECT COALESCE(SUM(distance_km), 0)::numeric
    INTO v_new_total
  FROM public.activity_logs
  WHERE registration_id = v_reg.id;
  v_new_total := round(v_new_total, 3);

  IF v_target > 0 AND v_new_total >= v_target AND v_reg.status = 'active' THEN
    UPDATE public.registrations
      SET total_km_logged = v_new_total,
          status = 'completed',
          completed_at = COALESCE(completed_at, now())
      WHERE id = v_reg.id;
    v_completed := true;
  ELSE
    UPDATE public.registrations
      SET total_km_logged = v_new_total
      WHERE id = v_reg.id;
  END IF;

  WITH new_ms AS (
    SELECT cm.id
    FROM public.challenge_milestones cm
    WHERE cm.challenge_id = v_reg.challenge_id
      AND cm.distance <= v_new_total
      AND NOT EXISTS (
        SELECT 1 FROM public.user_milestones um
        WHERE um.registration_id = v_reg.id AND um.milestone_id = cm.id
      )
  ), ins AS (
    INSERT INTO public.user_milestones (user_id, milestone_id, registration_id, km_at_unlock)
    SELECT _user_id, id, v_reg.id, v_new_total FROM new_ms
    RETURNING 1
  )
  SELECT count(*) INTO v_milestones_unlocked FROM ins;

  RETURN jsonb_build_object(
    'ok', true,
    'inserted', v_inserted,
    'merged', v_merged,
    'registration_id', v_reg.id,
    'challenge_id', v_reg.challenge_id,
    'distance_km', v_distance_km,
    'total_km_logged', v_new_total,
    'completed', v_completed,
    'milestones_unlocked', v_milestones_unlocked
  );
END $$;

-- Aggregator with distinct reason counters
CREATE OR REPLACE FUNCTION public.ingest_strava_activities(_user_id uuid, _activities jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_act jsonb;
  v_res jsonb;
  v_imported int := 0;
  v_dup int := 0;
  v_outside int := 0;
  v_wrong int := 0;
  v_total int := 0;
  v_completed boolean := false;
  v_milestones_unlocked int := 0;
  v_last_total numeric := 0;
  v_last_reg uuid;
  v_reason text;
BEGIN
  FOR v_act IN SELECT * FROM jsonb_array_elements(COALESCE(_activities, '[]'::jsonb))
  LOOP
    v_total := v_total + 1;
    v_res := public.ingest_strava_activity(_user_id, v_act);
    IF (v_res->>'ok')::boolean THEN
      IF (v_res->>'inserted')::boolean THEN
        v_imported := v_imported + 1;
      ELSIF COALESCE((v_res->>'merged')::boolean, false) THEN
        v_imported := v_imported + 1;
      ELSE
        v_dup := v_dup + 1;
      END IF;
      v_last_total := COALESCE((v_res->>'total_km_logged')::numeric, v_last_total);
      v_last_reg := (v_res->>'registration_id')::uuid;
      v_completed := v_completed OR COALESCE((v_res->>'completed')::boolean, false);
      v_milestones_unlocked := v_milestones_unlocked + COALESCE((v_res->>'milestones_unlocked')::int, 0);
    ELSE
      v_reason := v_res->>'reason';
      IF v_reason = 'wrong_sport_type' THEN
        v_wrong := v_wrong + 1;
      ELSIF v_reason IN ('no_active_window','no_matching_registration','no_start_date') THEN
        v_outside := v_outside + 1;
      ELSE
        v_outside := v_outside + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'fetched', v_total,
    'imported', v_imported,
    'duplicate', v_dup,
    'outsideWindow', v_outside,
    'wrongSport', v_wrong,
    'total_km_logged', v_last_total,
    'registration_id', v_last_reg,
    'completed', v_completed,
    'milestones_unlocked', v_milestones_unlocked
  );
END $$;

-- =====================================================================
-- 4. log_manual_activity — block duplicates of Strava imports
-- =====================================================================
CREATE OR REPLACE FUNCTION public.log_manual_activity(_registration_id uuid, _distance_km numeric, _activity_date date, _activity_type text, _notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reg record;
  v_target numeric;
  v_new_total numeric;
  v_completed boolean := false;
  v_unlocked int := 0;
  v_log_id uuid;
  v_dup_exists boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required' USING ERRCODE='42501'; END IF;
  IF _distance_km IS NULL OR _distance_km <= 0 THEN RAISE EXCEPTION 'invalid distance'; END IF;

  SELECT r.id, r.challenge_id, r.status, c.distance, r.registered_at,
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         )::date AS window_end
  INTO v_reg
  FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = _registration_id AND r.user_id = v_user;
  IF v_reg IS NULL THEN RAISE EXCEPTION 'registration not found' USING ERRCODE='P0001'; END IF;
  IF v_reg.status <> 'active' THEN RAISE EXCEPTION 'registration not active' USING ERRCODE='P0001'; END IF;

  v_target := v_reg.distance;
  IF _distance_km > v_target THEN RAISE EXCEPTION 'distance exceeds challenge target' USING ERRCODE='P0001'; END IF;
  IF _activity_date < v_reg.registered_at::date OR _activity_date > v_reg.window_end THEN
    RAISE EXCEPTION 'activity date outside challenge window' USING ERRCODE='P0001';
  END IF;

  -- Block duplicate of an already imported Strava activity (same day, ±0.5 km).
  SELECT EXISTS (
    SELECT 1 FROM public.activity_logs
    WHERE registration_id = v_reg.id
      AND source = 'strava'
      AND activity_date = _activity_date
      AND abs(distance_km - _distance_km) <= 0.5
  ) INTO v_dup_exists;
  IF v_dup_exists THEN
    RAISE EXCEPTION 'duplicate of imported Strava activity on the same day' USING ERRCODE='P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || v_reg.id::text));

  INSERT INTO public.activity_logs (
    user_id, registration_id, source, distance_km, activity_date, activity_type, raw_payload
  ) VALUES (
    v_user, v_reg.id, 'manual', _distance_km, _activity_date, _activity_type,
    CASE WHEN _notes IS NOT NULL THEN jsonb_build_object('notes', _notes) ELSE NULL END
  ) RETURNING id INTO v_log_id;

  SELECT COALESCE(SUM(distance_km),0)::numeric INTO v_new_total
    FROM public.activity_logs WHERE registration_id = v_reg.id;
  v_new_total := round(v_new_total, 3);

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
    'ok', true,
    'log_id', v_log_id,
    'registration_id', v_reg.id,
    'total_km_logged', v_new_total,
    'completed', v_completed,
    'milestones_unlocked', v_unlocked,
    'newly_unlocked_milestone_ids', (
      SELECT COALESCE(array_agg(um.milestone_id), ARRAY[]::uuid[])
      FROM public.user_milestones um
      WHERE um.registration_id = v_reg.id AND um.km_at_unlock = v_new_total
    )
  );
END $$;
