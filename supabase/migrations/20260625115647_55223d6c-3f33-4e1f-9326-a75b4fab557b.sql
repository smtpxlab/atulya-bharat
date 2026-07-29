ALTER TABLE public.challenge_milestones
  ADD COLUMN IF NOT EXISTS x_percent numeric,
  ADD COLUMN IF NOT EXISTS y_percent numeric;