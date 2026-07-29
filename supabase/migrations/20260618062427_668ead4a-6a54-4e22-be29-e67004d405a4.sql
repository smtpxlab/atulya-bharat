
-- Refactor testimonials to CMS spec
DROP POLICY IF EXISTS "Admins manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Approved testimonials viewable" ON public.testimonials;
DROP POLICY IF EXISTS "Users create own testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Users update own testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Users view own testimonials" ON public.testimonials;

ALTER TABLE public.testimonials DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.testimonials DROP COLUMN IF EXISTS city;
ALTER TABLE public.testimonials DROP COLUMN IF EXISTS challenge_id;
ALTER TABLE public.testimonials DROP COLUMN IF EXISTS rating;
ALTER TABLE public.testimonials DROP COLUMN IF EXISTS is_approved;
ALTER TABLE public.testimonials RENAME COLUMN name TO author_name;
ALTER TABLE public.testimonials RENAME COLUMN avatar_url TO image_url;
ALTER TABLE public.testimonials RENAME COLUMN content TO description;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP INDEX IF EXISTS idx_testimonials_approved;

GRANT SELECT ON public.testimonials TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;

CREATE POLICY "Testimonials are publicly readable"
  ON public.testimonials FOR SELECT USING (true);
CREATE POLICY "Admins can insert testimonials"
  ON public.testimonials FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update testimonials"
  ON public.testimonials FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete testimonials"
  ON public.testimonials FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS testimonials_updated_at ON public.testimonials;
CREATE TRIGGER testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FAQs
CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  status boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faqs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.faqs TO authenticated;
GRANT ALL ON public.faqs TO service_role;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enabled FAQs are publicly readable"
  ON public.faqs FOR SELECT USING (status = true OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert faqs"
  ON public.faqs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update faqs"
  ON public.faqs FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete faqs"
  ON public.faqs FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
