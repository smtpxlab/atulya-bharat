
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY challenge_id ORDER BY created_at, id) AS rn
  FROM public.challenge_milestones
  WHERE sort_order IS NULL
)
UPDATE public.challenge_milestones cm
SET sort_order = r.rn
FROM ranked r
WHERE cm.id = r.id;

ALTER TABLE public.challenge_milestones
  ALTER COLUMN sort_order SET DEFAULT 1,
  ALTER COLUMN sort_order SET NOT NULL;
