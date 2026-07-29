
-- Extend clubs
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS registration_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS discount_challenge_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cart_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS established_at date,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clubs_status_check'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_status_check
      CHECK (status IN ('draft','published','suspended'));
  END IF;
END$$;

-- Social links
CREATE TABLE IF NOT EXISTS public.club_social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_social_links_club_id_idx
  ON public.club_social_links(club_id);

GRANT SELECT ON public.club_social_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_social_links TO authenticated;
GRANT ALL ON public.club_social_links TO service_role;

ALTER TABLE public.club_social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club social links"
  ON public.club_social_links FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert club social links"
  ON public.club_social_links FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update club social links"
  ON public.club_social_links FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete club social links"
  ON public.club_social_links FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
