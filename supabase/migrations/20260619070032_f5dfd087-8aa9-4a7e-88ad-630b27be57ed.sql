ALTER TABLE public.contact_enquiries
  ADD COLUMN IF NOT EXISTS submitter_ip text,
  ADD COLUMN IF NOT EXISTS user_agent text;
CREATE INDEX IF NOT EXISTS contact_enquiries_ip_created_idx
  ON public.contact_enquiries (submitter_ip, created_at DESC);