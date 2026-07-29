
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS sport_type text,
  ADD COLUMN IF NOT EXISTS moving_time_seconds integer,
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS polyline text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_user_strava_unique
  ON public.activity_logs (user_id, strava_activity_id)
  WHERE strava_activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_logs_user_date_idx
  ON public.activity_logs (user_id, activity_date DESC);

CREATE OR REPLACE VIEW public.strava_connection_status
WITH (security_invoker = true) AS
SELECT
  user_id,
  strava_athlete_id,
  athlete_first_name,
  athlete_last_name,
  scope,
  expires_at,
  last_synced_at
FROM public.strava_tokens;

GRANT SELECT ON public.strava_connection_status TO authenticated;
