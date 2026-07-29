
CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled','disabled')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pages" ON public.pages
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert pages" ON public.pages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update pages" ON public.pages
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete pages" ON public.pages
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_pages_status ON public.pages(status);
CREATE INDEX idx_pages_created_at ON public.pages(created_at DESC);

CREATE TRIGGER trg_pages_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pages (title, slug, content, status) VALUES
  ('Terms & Conditions', 'terms-and-conditions', '', 'enabled'),
  ('Privacy Policy', 'privacy-policy', '', 'enabled'),
  ('Refund & Return Policy', 'refund-return-policy', '', 'enabled')
ON CONFLICT (slug) DO NOTHING;
