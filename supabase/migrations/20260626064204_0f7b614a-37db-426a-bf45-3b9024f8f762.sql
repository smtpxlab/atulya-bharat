
REVOKE EXECUTE ON FUNCTION public.last_strava_sync_run(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recent_strava_sync_runs(uuid, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.last_strava_sync_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recent_strava_sync_runs(uuid, int) TO authenticated;
