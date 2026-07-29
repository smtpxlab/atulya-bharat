-- Tighten x/y to numeric(5,2) with bounds, add audit + reserved columns
ALTER TABLE public.challenge_milestones
  ALTER COLUMN x_percent TYPE numeric(5,2) USING ROUND(x_percent::numeric, 2),
  ALTER COLUMN y_percent TYPE numeric(5,2) USING ROUND(y_percent::numeric, 2);

ALTER TABLE public.challenge_milestones
  DROP CONSTRAINT IF EXISTS challenge_milestones_x_percent_range,
  DROP CONSTRAINT IF EXISTS challenge_milestones_y_percent_range;

ALTER TABLE public.challenge_milestones
  ADD CONSTRAINT challenge_milestones_x_percent_range CHECK (x_percent IS NULL OR (x_percent >= 0 AND x_percent <= 100)),
  ADD CONSTRAINT challenge_milestones_y_percent_range CHECK (y_percent IS NULL OR (y_percent >= 0 AND y_percent <= 100));

ALTER TABLE public.challenge_milestones
  ADD COLUMN IF NOT EXISTS coords_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS coords_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marker_icon text,
  ADD COLUMN IF NOT EXISTS marker_color text,
  ADD COLUMN IF NOT EXISTS marker_size text,
  ADD COLUMN IF NOT EXISTS custom_label_position text;