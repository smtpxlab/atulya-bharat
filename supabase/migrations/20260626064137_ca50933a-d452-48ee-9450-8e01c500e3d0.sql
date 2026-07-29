
-- 1. Surface refresh_failed_at in connection status view
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
  last_synced_at,
  refresh_failed_at
FROM public.strava_tokens;

GRANT SELECT ON public.strava_connection_status TO authenticated;

-- 2. Per-run sync history
CREATE TABLE IF NOT EXISTS public.strava_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('manual','full','cron','webhook')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched int NOT NULL DEFAULT 0,
  imported int NOT NULL DEFAULT 0,
  duplicate int NOT NULL DEFAULT 0,
  outside_window int NOT NULL DEFAULT 0,
  wrong_sport int NOT NULL DEFAULT 0,
  milestones_unlocked int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','skipped')),
  reason text,
  error text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strava_sync_runs_user_started_idx
  ON public.strava_sync_runs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS strava_sync_runs_status_idx
  ON public.strava_sync_runs(status, started_at DESC);

GRANT SELECT ON public.strava_sync_runs TO authenticated;
GRANT ALL ON public.strava_sync_runs TO service_role;

ALTER TABLE public.strava_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own sync runs"
  ON public.strava_sync_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admins read all sync runs"
  ON public.strava_sync_runs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Subscription health snapshot (one row per environment / id)
CREATE TABLE IF NOT EXISTS public.strava_subscription_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  subscription_id bigint,
  callback_url text,
  status text NOT NULL CHECK (status IN ('ok','missing','error')),
  error text,
  raw jsonb
);

CREATE INDEX IF NOT EXISTS strava_subscription_health_checked_idx
  ON public.strava_subscription_health(checked_at DESC);

GRANT SELECT ON public.strava_subscription_health TO authenticated;
GRANT ALL ON public.strava_subscription_health TO service_role;

ALTER TABLE public.strava_subscription_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read subscription health"
  ON public.strava_subscription_health FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 4. RPC: last sync run summary for current user (used by dashboard banner)
CREATE OR REPLACE FUNCTION public.last_strava_sync_run(_user_id uuid)
RETURNS TABLE (
  id uuid,
  source text,
  started_at timestamptz,
  finished_at timestamptz,
  fetched int,
  imported int,
  duplicate int,
  outside_window int,
  wrong_sport int,
  milestones_unlocked int,
  completed boolean,
  status text,
  reason text,
  error text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, source, started_at, finished_at, fetched, imported, duplicate,
         outside_window, wrong_sport, milestones_unlocked, completed,
         status, reason, error
  FROM public.strava_sync_runs
  WHERE user_id = _user_id
  ORDER BY started_at DESC
  LIMIT 1;
$$;

-- 5. RPC: recent sync runs for current user (history drawer)
CREATE OR REPLACE FUNCTION public.recent_strava_sync_runs(_user_id uuid, _limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  source text,
  started_at timestamptz,
  finished_at timestamptz,
  fetched int,
  imported int,
  duplicate int,
  outside_window int,
  wrong_sport int,
  milestones_unlocked int,
  completed boolean,
  status text,
  reason text,
  error text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, source, started_at, finished_at, fetched, imported, duplicate,
         outside_window, wrong_sport, milestones_unlocked, completed,
         status, reason, error
  FROM public.strava_sync_runs
  WHERE user_id = _user_id
  ORDER BY started_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;
