
CREATE OR REPLACE FUNCTION public.guard_non_negative_distance()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb := to_jsonb(NEW);
BEGIN
  IF TG_TABLE_NAME = 'activity_logs' THEN
    IF COALESCE((v->>'distance_km')::numeric, 0) < 0 THEN
      RAISE EXCEPTION 'distance_km must be >= 0';
    END IF;
  ELSIF TG_TABLE_NAME = 'registrations' THEN
    IF COALESCE((v->>'total_km_logged')::numeric, 0) < 0 THEN
      RAISE EXCEPTION 'total_km_logged must be >= 0';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
