
-- ============================================================
-- Hardening migration: Athlete Challenge Engine audit fixes
-- ============================================================

-- 1) register_for_challenge: prevent cross-user registration via authenticated callers.
--    Service role (auth.uid() IS NULL) keeps working from edge functions.
CREATE OR REPLACE FUNCTION public.register_for_challenge(
  _user_id uuid, _challenge_id uuid, _ticket_id uuid,
  _activity_mode text, _target_days integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_existing record; v_new_id uuid;
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

-- 2) Lock down direct mutation of registrations by end users.
--    Status / totals / window must only change via SECURITY DEFINER paths (sync, RPCs, admin).
DROP POLICY IF EXISTS "Users update own registrations" ON public.registrations;
-- (no replacement policy — users can no longer self-update registrations.
--  Admin policy "Admins manage registrations" and SECURITY DEFINER functions remain.)

-- 3) Status transition guard on registrations.
CREATE OR REPLACE FUNCTION public.guard_registration_status_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Allow admins / service_role to override.
    IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;
    -- Terminal states cannot be reopened by non-admins.
    IF OLD.status IN ('completed', 'expired', 'cancelled') THEN
      RAISE EXCEPTION 'registration status % is terminal', OLD.status USING ERRCODE = '42501';
    END IF;
    -- Active rows can only move to cancelled by the owner.
    IF OLD.status = 'active' AND NEW.status NOT IN ('cancelled') THEN
      RAISE EXCEPTION 'invalid status transition % -> %', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_registrations_status_transition ON public.registrations;
CREATE TRIGGER trg_registrations_status_transition
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_registration_status_transition();

-- 4) Lock down activity_logs writes from clients.
--    Strava sync uses service_role and bypasses RLS — unaffected.
DROP POLICY IF EXISTS "Users insert own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Users update own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Users delete own activity" ON public.activity_logs;

CREATE POLICY "Users insert own manual activity"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND source = 'manual'
    AND registration_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = registration_id
        AND r.user_id = auth.uid()
        AND r.status = 'active'
    )
  );

CREATE POLICY "Users delete own manual activity"
  ON public.activity_logs FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND source = 'manual'
  );
-- intentionally no UPDATE policy: users can only delete+reinsert manual entries.

-- 5) Cross-table integrity guard on activity_logs.
--    Ensures every log row points to a registration owned by the same user
--    and (for non-admin paths) that the registration is still active.
CREATE OR REPLACE FUNCTION public.guard_activity_log_registration()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_reg_user uuid; v_reg_status registration_status;
BEGIN
  IF NEW.registration_id IS NULL THEN
    RETURN NEW; -- legacy/manual without registration: allowed but won't count toward progress
  END IF;
  SELECT user_id, status INTO v_reg_user, v_reg_status
  FROM public.registrations WHERE id = NEW.registration_id;
  IF v_reg_user IS NULL THEN
    RAISE EXCEPTION 'registration % not found', NEW.registration_id;
  END IF;
  IF v_reg_user <> NEW.user_id THEN
    RAISE EXCEPTION 'activity user_id does not match registration owner';
  END IF;
  -- Block logging into a non-active registration unless caller is admin/service_role.
  IF v_reg_status <> 'active' AND auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'cannot log activity against % registration', v_reg_status USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_activity_logs_registration ON public.activity_logs;
CREATE TRIGGER trg_activity_logs_registration
  BEFORE INSERT OR UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.guard_activity_log_registration();

-- 6) Rewrite legacy challenge_progress to delegate to registration-scoped version.
CREATE OR REPLACE FUNCTION public.challenge_progress(_user_id uuid, _challenge_id uuid)
RETURNS TABLE(
  distance_target_km numeric, distance_logged_km numeric, distance_remaining_km numeric,
  pct_complete numeric, activities_count integer,
  milestones_total integer, milestones_unlocked integer,
  is_complete boolean, window_start date, window_end date,
  registered_at timestamptz, activity_mode text,
  first_activity_date date, last_activity_date date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg_id uuid;
BEGIN
  SELECT id INTO v_reg_id
  FROM public.registrations
  WHERE user_id = _user_id AND challenge_id = _challenge_id
  ORDER BY registered_at DESC LIMIT 1;
  IF v_reg_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.distance_target_km, p.distance_logged_km, p.distance_remaining_km,
         p.pct_complete, p.activities_count,
         p.milestones_total, p.milestones_unlocked,
         p.is_complete, p.window_start, p.window_end,
         p.registered_at, p.activity_mode,
         p.first_activity_date, p.last_activity_date
  FROM public.challenge_progress_by_registration(v_reg_id) p;
END $$;

-- 7) Registration-scoped leaderboard (uses correct milestone table + status filter).
CREATE OR REPLACE FUNCTION public.challenge_leaderboard(
  _challenge_id uuid, _limit integer DEFAULT 20, _offset integer DEFAULT 0
)
RETURNS TABLE(
  user_id uuid, full_name text, avatar_url text,
  km_logged numeric, pct_complete numeric, activity_mode text,
  milestones_unlocked integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ch AS (SELECT id, distance FROM public.challenges WHERE id = _challenge_id),
  ms AS (
    SELECT um.user_id, COUNT(*)::int AS n
    FROM public.user_milestones um
    JOIN public.challenge_milestones cm ON cm.id = um.milestone_id
    WHERE cm.challenge_id = _challenge_id
    GROUP BY um.user_id
  )
  SELECT r.user_id, p.full_name, p.avatar_url, r.total_km_logged,
    CASE WHEN ch.distance > 0
         THEN LEAST(100, ROUND(r.total_km_logged / ch.distance * 100, 1))
         ELSE 0 END,
    COALESCE(r.activity_mode::text, 'any'),
    COALESCE(ms.n, 0)
  FROM public.registrations r
  JOIN ch ON true
  JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN ms ON ms.user_id = r.user_id
  WHERE r.challenge_id = _challenge_id
    AND r.status IN ('active', 'completed')
  ORDER BY r.total_km_logged DESC
  LIMIT _limit OFFSET _offset
$$;

-- 8) Cancellation RPC for users (only path to write 'cancelled').
CREATE OR REPLACE FUNCTION public.cancel_active_registration()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.registrations
     SET status = 'cancelled'
   WHERE user_id = auth.uid() AND status = 'active'
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_registration');
  END IF;
  RETURN jsonb_build_object('ok', true, 'registration_id', v_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.cancel_active_registration() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_active_registration() TO authenticated, service_role;
