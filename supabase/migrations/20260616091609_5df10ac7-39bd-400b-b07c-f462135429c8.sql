GRANT SELECT ON public.pages TO anon;

CREATE POLICY "Public can view enabled pages" ON public.pages
  FOR SELECT
  TO anon, authenticated
  USING (status = 'enabled');