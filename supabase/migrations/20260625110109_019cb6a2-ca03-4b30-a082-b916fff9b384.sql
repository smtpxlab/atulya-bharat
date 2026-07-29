
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS participation_photo_url text;

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS bib_overlay_config jsonb;
