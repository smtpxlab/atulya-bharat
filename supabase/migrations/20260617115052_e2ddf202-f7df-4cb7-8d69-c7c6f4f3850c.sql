ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
UPDATE public.challenges
SET tags = ARRAY(
  SELECT trim(t)
  FROM unnest(string_to_array(theme, ',')) AS t
  WHERE trim(t) <> ''
)
WHERE theme IS NOT NULL AND theme <> '' AND (tags IS NULL OR cardinality(tags) = 0);
ALTER TABLE public.challenges DROP COLUMN IF EXISTS theme;
CREATE INDEX IF NOT EXISTS idx_challenges_tags ON public.challenges USING gin (tags);