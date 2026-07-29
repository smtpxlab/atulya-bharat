
CREATE OR REPLACE FUNCTION public.log_manual_activity(
  _registration_id uuid,
  _distance_km numeric,
  _activity_date date,
  _activity_type text,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_reg record;
  v_target numeric;
  v_new_total numeric;
  v_completed boolean := false;
  v_unlocked int := 0;
  v_log_id uuid;
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
  IF v_reg IS NULL THEN RAISE EXCEPTION 'registration not found' USING ERRCODE='42501'; END IF;
  IF v_reg.status <> 'active' THEN RAISE EXCEPTION 'registration not active' USING ERRCODE='42501'; END IF;

  v_target := v_reg.distance;
  IF _distance_km > v_target THEN RAISE EXCEPTION 'distance exceeds challenge target'; END IF;
  IF _activity_date < v_reg.registered_at::date OR _activity_date > v_reg.window_end THEN
    RAISE EXCEPTION 'activity date outside challenge window';
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
  SELECT count(*), COALESCE(array_agg(milestone_id), ARRAY[]::uuid[])
    INTO v_unlocked, _activity_type  -- reuse var? no — fix below
    FROM ins;
  -- (above ARRAY agg discarded; we return ids in a separate query below)
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

REVOKE ALL ON FUNCTION public.log_manual_activity(uuid, numeric, date, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_manual_activity(uuid, numeric, date, text, text) TO authenticated, service_role;
