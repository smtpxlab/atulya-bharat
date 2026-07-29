-- Contact enquiries table
CREATE TABLE public.contact_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_enquiries TO anon, authenticated;
GRANT ALL ON public.contact_enquiries TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.contact_enquiries TO authenticated;

ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit enquiries"
  ON public.contact_enquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins view enquiries"
  ON public.contact_enquiries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage enquiries"
  ON public.contact_enquiries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage RLS for new buckets (buckets themselves created via storage tool)
-- Public read for blog-images, gallery, challenge-covers, milestone-images, milestone-audio
CREATE POLICY "Public read blog-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-images');

CREATE POLICY "Admins write blog-images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read gallery"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "Admins write gallery"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'gallery' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read challenge-covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'challenge-covers');

CREATE POLICY "Admins write challenge-covers"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'challenge-covers' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'challenge-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read milestone-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'milestone-images');

CREATE POLICY "Admins write milestone-images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'milestone-images' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'milestone-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read milestone-audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'milestone-audio');

CREATE POLICY "Admins write milestone-audio"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'milestone-audio' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'milestone-audio' AND public.has_role(auth.uid(), 'admin'));