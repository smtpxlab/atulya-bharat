ALTER TABLE public.strava_tokens
  ADD COLUMN IF NOT EXISTS athlete_avatar_url text,
  ADD COLUMN IF NOT EXISTS athlete_username text,
  ADD COLUMN IF NOT EXISTS athlete_city text,
  ADD COLUMN IF NOT EXISTS athlete_country text;

DROP VIEW IF EXISTS public.strava_connection_status;

CREATE VIEW public.strava_connection_status
WITH (security_invoker = true) AS
SELECT
  user_id,
  strava_athlete_id,
  athlete_first_name,
  athlete_last_name,
  athlete_avatar_url,
  athlete_username,
  athlete_city,
  athlete_country,
  scope,
  expires_at,
  last_synced_at
FROM public.strava_tokens;

GRANT SELECT ON public.strava_connection_status TO authenticated;