-- 1. Add athlete name columns
ALTER TABLE public.strava_tokens
  ADD COLUMN IF NOT EXISTS athlete_first_name text,
  ADD COLUMN IF NOT EXISTS athlete_last_name text;

-- 2. Enable RLS on strava_tokens (it had none)
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own strava token"
  ON public.strava_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own strava token"
  ON public.strava_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own strava token"
  ON public.strava_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own strava token"
  ON public.strava_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage strava tokens"
  ON public.strava_tokens FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Enable realtime for live dashboard updates
ALTER TABLE public.registrations REPLICA IDENTITY FULL;
ALTER TABLE public.user_milestones REPLICA IDENTITY FULL;
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_milestones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;