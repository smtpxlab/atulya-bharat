
-- 1) De-duplicate any existing Strava rows: keep the earliest by logged_at
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, strava_activity_id ORDER BY logged_at ASC, id ASC) AS rn
  FROM public.activity_logs
  WHERE strava_activity_id IS NOT NULL
)
DELETE FROM public.activity_logs a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

-- 2) Unique index for idempotent Strava ingest
CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_user_strava_unique
  ON public.activity_logs(user_id, strava_activity_id)
  WHERE strava_activity_id IS NOT NULL;

-- 3) Helpful index for recent-activity listings
CREATE INDEX IF NOT EXISTS activity_logs_reg_date_idx
  ON public.activity_logs(registration_id, activity_date DESC, logged_at DESC);

-- 4) Track refresh failures so the UI can prompt reconnect
ALTER TABLE public.strava_tokens
  ADD COLUMN IF NOT EXISTS refresh_failed_at timestamptz;

-- 5) Recompute total_km_logged for every registration from the (now de-duped) activity_logs
UPDATE public.registrations r
SET total_km_logged = COALESCE(s.km, 0)
FROM (
  SELECT registration_id, ROUND(SUM(distance_km)::numeric, 3) AS km
  FROM public.activity_logs
  WHERE registration_id IS NOT NULL
  GROUP BY registration_id
) s
WHERE s.registration_id = r.id
  AND r.total_km_logged IS DISTINCT FROM COALESCE(s.km, 0);
