
-- ============================================================
-- Phase 1: schema cleanup on activity_logs
-- ============================================================
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS elapsed_time_seconds integer,
  ADD COLUMN IF NOT EXISTS average_speed_mps numeric;

-- Drop redundant per-registration unique (user-wide unique already prevents dupes).
DROP INDEX IF EXISTS public.activity_logs_strava_per_reg_uniq;

-- Drop duplicate raw_data column (raw_payload is the canonical jsonb).
ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS raw_data;

CREATE INDEX IF NOT EXISTS idx_activity_logs_start_date
  ON public.activity_logs (start_date DESC) WHERE start_date IS NOT NULL;

-- ============================================================
-- Phase 2: registrations.completed_at
-- ============================================================
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- ============================================================
-- Phase 3: user_milestones — re-key per registration
-- ============================================================
-- Drop the old user-wide unique so re-registration can replay milestones.
ALTER TABLE public.user_milestones
  DROP CONSTRAINT IF EXISTS user_milestones_user_id_milestone_id_key;

DROP INDEX IF EXISTS public.user_milestones_user_id_milestone_id_key;

-- Enforce uniqueness per (registration, milestone) for rows where registration_id is set.
CREATE UNIQUE INDEX IF NOT EXISTS user_milestones_reg_milestone_uniq
  ON public.user_milestones (registration_id, milestone_id)
  WHERE registration_id IS NOT NULL;

-- ============================================================
-- Phase 4: strava_webhook_events (dedupe + observability)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.strava_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time bigint NOT NULL,
  object_id bigint NOT NULL,
  object_type text NOT NULL,
  aspect_type text NOT NULL,
  owner_id bigint,
  updates jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);

CREATE UNIQUE INDEX IF NOT EXISTS strava_webhook_events_unique
  ON public.strava_webhook_events (object_id, aspect_type, event_time);

GRANT ALL ON public.strava_webhook_events TO service_role;
ALTER TABLE public.strava_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view webhook events" ON public.strava_webhook_events;
CREATE POLICY "Admins view webhook events"
  ON public.strava_webhook_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- Phase 5: ingest / delete Strava activity RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.ingest_strava_activity(
  _user_id uuid,
  _activity jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Resolve a registration whose window contains the activity start
  -- and whose mode accepts the sport. Prefer active.
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
    RETURN jsonb_build_object('ok', false, 'reason', 'no_matching_registration');
  END IF;

  -- Serialize concurrent ingest for this registration.
  PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || v_reg.id::text));

  -- Upsert idempotently on (user_id, strava_activity_id).
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

  -- Recompute total from activity_logs (single source of truth).
  SELECT COALESCE(SUM(distance_km), 0)::numeric
    INTO v_new_total
  FROM public.activity_logs
  WHERE registration_id = v_reg.id;
  v_new_total := round(v_new_total, 3);

  -- Flip to completed when target reached (only from active).
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

  -- Unlock newly-passed milestones for this registration.
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
    'registration_id', v_reg.id,
    'challenge_id', v_reg.challenge_id,
    'distance_km', v_distance_km,
    'total_km_logged', v_new_total,
    'completed', v_completed,
    'milestones_unlocked', v_milestones_unlocked
  );
END $$;

REVOKE ALL ON FUNCTION public.ingest_strava_activity(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_strava_activity(uuid, jsonb) TO service_role;

-- Batch ingest helper for sync-manual.
CREATE OR REPLACE FUNCTION public.ingest_strava_activities(
  _user_id uuid,
  _activities jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  FOR v_act IN SELECT * FROM jsonb_array_elements(COALESCE(_activities, '[]'::jsonb))
  LOOP
    v_total := v_total + 1;
    v_res := public.ingest_strava_activity(_user_id, v_act);
    IF (v_res->>'ok')::boolean THEN
      IF (v_res->>'inserted')::boolean THEN v_imported := v_imported + 1; ELSE v_dup := v_dup + 1; END IF;
      v_last_total := COALESCE((v_res->>'total_km_logged')::numeric, v_last_total);
      v_last_reg := (v_res->>'registration_id')::uuid;
      v_completed := v_completed OR COALESCE((v_res->>'completed')::boolean, false);
      v_milestones_unlocked := v_milestones_unlocked + COALESCE((v_res->>'milestones_unlocked')::int, 0);
    ELSIF v_res->>'reason' IN ('no_matching_registration','no_start_date') THEN
      v_outside := v_outside + 1;
    ELSE
      v_wrong := v_wrong + 1;
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

REVOKE ALL ON FUNCTION public.ingest_strava_activities(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_strava_activities(uuid, jsonb) TO service_role;

-- Delete activity (Strava webhook delete event)
CREATE OR REPLACE FUNCTION public.delete_strava_activity(
  _user_id uuid,
  _strava_activity_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg uuid;
  v_new_total numeric;
  v_target numeric;
  v_status registration_status;
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

  SELECT COALESCE(SUM(distance_km), 0)::numeric INTO v_new_total
    FROM public.activity_logs WHERE registration_id = v_reg;
  v_new_total := round(v_new_total, 3);

  SELECT c.distance, r.status INTO v_target, v_status
    FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
    WHERE r.id = v_reg;

  -- Demote from completed if no longer over target.
  IF v_status = 'completed' AND v_new_total < v_target THEN
    UPDATE public.registrations
      SET total_km_logged = v_new_total,
          status = 'active',
          completed_at = NULL
      WHERE id = v_reg;
  ELSE
    UPDATE public.registrations
      SET total_km_logged = v_new_total
      WHERE id = v_reg;
  END IF;

  RETURN jsonb_build_object('ok', true, 'deleted', true, 'registration_id', v_reg, 'total_km_logged', v_new_total);
END $$;

REVOKE ALL ON FUNCTION public.delete_strava_activity(uuid, bigint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_strava_activity(uuid, bigint) TO service_role;

-- ============================================================
-- Phase 6: register_for_challenge — enforce mode from challenge_type
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_for_challenge(_user_id uuid, _challenge_id uuid, _ticket_id uuid, _activity_mode text, _target_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing record;
  v_new_id uuid;
  v_ctype text;
  v_mode text;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM public.expire_registrations(_user_id);
  SELECT r.id, c.name INTO v_existing
  FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.user_id = _user_id AND r.status = 'active' LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'active_challenge_exists',
      'registration_id', v_existing.id, 'challenge_name', v_existing.name);
  END IF;

  SELECT challenge_type INTO v_ctype FROM public.challenges WHERE id = _challenge_id;
  v_mode := lower(COALESCE(NULLIF(_activity_mode,''), ''));
  IF v_mode IN ('', 'any') THEN
    v_mode := CASE
      WHEN v_ctype ILIKE 'ride' OR v_ctype ILIKE '%cycling%' THEN 'ride'
      WHEN v_ctype ILIKE 'run/walk' OR v_ctype ILIKE 'walk%' THEN 'walk'
      WHEN v_ctype ILIKE 'run' THEN 'run'
      ELSE 'any'
    END;
  END IF;

  INSERT INTO public.registrations (
    user_id, challenge_id, ticket_id, activity_mode, target_days,
    status, registered_at, total_km_logged
  ) VALUES (
    _user_id, _challenge_id, _ticket_id,
    v_mode::activity_mode,
    _target_days, 'active', now(), 0
  ) RETURNING id INTO v_new_id;
  RETURN jsonb_build_object('ok', true, 'registration_id', v_new_id);
END $function$;

-- ============================================================
-- Phase 7: challenge_progress_by_registration — fix is_complete, days_left cap, last_activity from start_date
-- ============================================================
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
    SELECT COALESCE(SUM(distance_km),0)::numeric AS km, COUNT(*)::int AS n,
           MIN(activity_date) AS first_d,
           GREATEST(MAX(activity_date), COALESCE(MAX(start_date)::date, '-infinity'::date)) AS last_d
    FROM acts
  ),
  ms AS (SELECT COUNT(*)::int AS total FROM public.challenge_milestones WHERE challenge_id = v_chal),
  ums AS (
    SELECT COUNT(*)::int AS unlocked FROM public.user_milestones um
    JOIN public.challenge_milestones cm ON cm.id = um.milestone_id
    WHERE um.registration_id = _registration_id
  )
  SELECT _registration_id, v_chal, v_user,
    COALESCE(v_target,0)::numeric, ROUND(LEAST(agg.km, COALESCE(v_target, agg.km)), 3),
    GREATEST(0, ROUND(COALESCE(v_target,0) - agg.km, 3)),
    CASE WHEN COALESCE(v_target,0) > 0 THEN LEAST(100, ROUND(agg.km / v_target * 100, 1)) ELSE 0 END,
    agg.n, ms.total, ums.unlocked,
    (agg.km >= COALESCE(v_target,0) AND COALESCE(v_target,0) > 0 AND v_status IN ('active','completed')),
    v_start, v_end, v_reg_at, v_mode,
    agg.first_d, NULLIF(agg.last_d, '-infinity'::date),
    v_days
  FROM agg, ms, ums;
END $function$;

-- ============================================================
-- Phase 8: tighten RLS — user_milestones (revoke client INSERT/UPDATE; RPCs only)
-- ============================================================
DROP POLICY IF EXISTS "Users insert own milestones" ON public.user_milestones;
DROP POLICY IF EXISTS "Users update own milestones" ON public.user_milestones;
-- SELECT and admin policies remain. INSERT/UPDATE now only via SECURITY DEFINER RPCs.

-- ============================================================
-- Phase 9: tighten registrations INSERT (defense in depth)
-- ============================================================
DROP POLICY IF EXISTS "Users create own registrations" ON public.registrations;
CREATE POLICY "Users create own registrations"
  ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND total_km_logged = 0
    AND completed_at IS NULL
    AND status IN ('active','pending_payment')
  );
