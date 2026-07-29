
-- ============================================================
-- 1. BIB & Certificate numbers
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.registrations_bib_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.registrations_certificate_seq START 1;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS bib_number text,
  ADD COLUMN IF NOT EXISTS certificate_number text;

CREATE UNIQUE INDEX IF NOT EXISTS registrations_bib_number_key
  ON public.registrations(bib_number) WHERE bib_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_certificate_number_key
  ON public.registrations(certificate_number) WHERE certificate_number IS NOT NULL;

-- Backfill existing rows in registration order.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, status, completed_at
    FROM public.registrations
    WHERE bib_number IS NULL OR (status = 'completed' AND certificate_number IS NULL)
    ORDER BY registered_at ASC
  LOOP
    UPDATE public.registrations
       SET bib_number = COALESCE(bib_number,
            'ABR-' || lpad(nextval('public.registrations_bib_seq')::text, 6, '0')),
           certificate_number = CASE
             WHEN r.status = 'completed' AND certificate_number IS NULL
               THEN 'ABR-CERT-' || lpad(nextval('public.registrations_certificate_seq')::text, 6, '0')
             ELSE certificate_number
           END
     WHERE id = r.id;
  END LOOP;
END $$;

-- BIB assignment on insert.
CREATE OR REPLACE FUNCTION public.registrations_assign_bib()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.bib_number IS NULL THEN
    NEW.bib_number := 'ABR-' || lpad(nextval('public.registrations_bib_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_registrations_assign_bib ON public.registrations;
CREATE TRIGGER trg_registrations_assign_bib
  BEFORE INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.registrations_assign_bib();

-- Certificate assignment when status flips to completed.
CREATE OR REPLACE FUNCTION public.registrations_assign_certificate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.certificate_number IS NULL THEN
    NEW.certificate_number := 'ABR-CERT-' ||
      lpad(nextval('public.registrations_certificate_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_registrations_assign_certificate ON public.registrations;
CREATE TRIGGER trg_registrations_assign_certificate
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.registrations_assign_certificate();

-- Loosen INSERT policy to allow the trigger-set bib_number (still restricts user-controlled fields).
-- The current policy whitelists rows where completed_at IS NULL AND total_km_logged = 0;
-- bib_number is set in BEFORE INSERT and isn't in the policy CHECK, so no policy change needed.

-- ============================================================
-- 2. log_manual_activity – relax duplicate guard for QA usability
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_manual_activity(
  _registration_id uuid,
  _distance_km numeric,
  _activity_date date,
  _activity_type text,
  _notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF v_user IS NULL THEN RAISE EXCEPTION 'Please sign in to log an activity.' USING ERRCODE='42501'; END IF;
  IF _distance_km IS NULL OR _distance_km <= 0 THEN
    RAISE EXCEPTION 'Distance must be greater than 0.' USING ERRCODE='P0001';
  END IF;

  SELECT r.id, r.challenge_id, r.status, c.distance, r.registered_at,
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         )::date AS window_end
  INTO v_reg
  FROM public.registrations r JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = _registration_id AND r.user_id = v_user;
  IF v_reg IS NULL THEN
    RAISE EXCEPTION 'Registration not found.' USING ERRCODE='P0001';
  END IF;
  IF v_reg.status = 'completed' THEN
    RAISE EXCEPTION 'You have already completed this challenge.' USING ERRCODE='P0001';
  END IF;
  IF v_reg.status <> 'active' THEN
    RAISE EXCEPTION 'This challenge is not active.' USING ERRCODE='P0001';
  END IF;

  v_target := v_reg.distance;
  IF _distance_km > v_target THEN
    RAISE EXCEPTION 'A single activity cannot exceed the challenge target of % km.', v_target USING ERRCODE='P0001';
  END IF;
  IF _activity_date < v_reg.registered_at::date OR _activity_date > v_reg.window_end THEN
    RAISE EXCEPTION 'Pick a date between % and %.', v_reg.registered_at::date, v_reg.window_end USING ERRCODE='P0001';
  END IF;

  -- Only block an exact duplicate manual entry on the same date.
  -- Strava overlap is already handled by ingest_strava_activity's merge logic.
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
END $function$;

-- ============================================================
-- 3. admin_force_complete_registration – QA helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_force_complete_registration(_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_reg record;
  v_remaining numeric;
  v_log_id uuid;
  v_unlocked int := 0;
BEGIN
  IF v_caller IS NULL OR NOT public.is_admin(v_caller) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;

  SELECT r.id, r.user_id, r.challenge_id, r.status, r.total_km_logged,
         c.distance AS target
    INTO v_reg
  FROM public.registrations r
  JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.id = _registration_id;
  IF v_reg IS NULL THEN RAISE EXCEPTION 'registration not found' USING ERRCODE='P0001'; END IF;

  v_remaining := GREATEST(0, v_reg.target - COALESCE(v_reg.total_km_logged, 0));

  PERFORM pg_advisory_xact_lock(hashtext('strava-reg:' || v_reg.id::text));

  IF v_remaining > 0 THEN
    INSERT INTO public.activity_logs (
      user_id, registration_id, source, distance_km, activity_date, activity_type, raw_payload
    ) VALUES (
      v_reg.user_id, v_reg.id, 'manual', v_remaining, current_date, 'run',
      jsonb_build_object('notes', 'Admin force-complete', 'admin', true)
    ) RETURNING id INTO v_log_id;
  END IF;

  UPDATE public.registrations
     SET total_km_logged = GREATEST(v_reg.target, v_reg.total_km_logged),
         status = 'completed',
         completed_at = COALESCE(completed_at, now())
   WHERE id = v_reg.id;

  WITH new_ms AS (
    SELECT cm.id FROM public.challenge_milestones cm
    WHERE cm.challenge_id = v_reg.challenge_id
      AND cm.distance <= v_reg.target
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
                            'log_id', v_log_id,
                            'added_km', v_remaining,
                            'milestones_unlocked', v_unlocked);
END $function$;

REVOKE ALL ON FUNCTION public.admin_force_complete_registration(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_complete_registration(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_manual_activity(uuid, numeric, date, text, text) TO authenticated, service_role;
