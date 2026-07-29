CREATE OR REPLACE FUNCTION public.guard_registration_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_target numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Allow service/admin contexts to override.
    IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;

    -- Terminal states cannot be reopened by non-admins.
    IF OLD.status IN ('completed', 'expired', 'cancelled') THEN
      RAISE EXCEPTION 'registration status % is terminal', OLD.status USING ERRCODE = '42501';
    END IF;

    -- Allow normal challenge completion when progress reaches the target.
    IF OLD.status = 'active' AND NEW.status = 'completed' THEN
      SELECT c.distance INTO v_target
      FROM public.challenges c
      WHERE c.id = NEW.challenge_id;

      IF COALESCE(NEW.total_km_logged, 0) >= COALESCE(v_target, 0)
         AND COALESCE(v_target, 0) > 0 THEN
        NEW.completed_at := COALESCE(NEW.completed_at, now());
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'challenge target has not been reached' USING ERRCODE = '42501';
    END IF;

    -- Active rows can only move to cancelled by the owner.
    IF OLD.status = 'active' AND NEW.status NOT IN ('cancelled') THEN
      RAISE EXCEPTION 'invalid status transition % -> %', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $function$;