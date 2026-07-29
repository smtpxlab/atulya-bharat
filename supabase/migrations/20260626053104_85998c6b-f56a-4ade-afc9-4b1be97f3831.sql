
CREATE OR REPLACE FUNCTION public.active_registration(_user_id uuid)
 RETURNS TABLE(registration_id uuid, challenge_id uuid, challenge_name text, challenge_slug text, distance_target_km numeric, activity_mode text, registered_at timestamp with time zone, window_end timestamp with time zone, total_km_logged numeric, cover_image_url text)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.expire_registrations(_user_id);
  RETURN QUERY
  SELECT r.id, c.id, c.name, c.slug, c.distance,
         COALESCE(r.activity_mode::text, 'any'),
         r.registered_at,
         LEAST(
           COALESCE(c.end_at, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
           COALESCE(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
         ),
         r.total_km_logged, c.cover_image_url
  FROM public.registrations r
  JOIN public.challenges c ON c.id = r.challenge_id
  WHERE r.user_id = _user_id AND r.status = 'active'
  LIMIT 1;
END $function$;
