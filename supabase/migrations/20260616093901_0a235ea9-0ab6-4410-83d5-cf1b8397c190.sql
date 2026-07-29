
ALTER TABLE public.gallery_images ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.gallery_images ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE public.gallery_images SET image_url = storage_url WHERE image_url IS NULL;

-- Reset RLS policies on gallery_images
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='gallery_images' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.gallery_images', p.policyname);
  END LOOP;
END $$;

GRANT SELECT ON public.gallery_images TO anon;
GRANT SELECT, INSERT, DELETE ON public.gallery_images TO authenticated;
GRANT ALL ON public.gallery_images TO service_role;

ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view gallery images"
  ON public.gallery_images FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert gallery images"
  ON public.gallery_images FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete gallery images"
  ON public.gallery_images FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Storage policies for `gallery` bucket
DROP POLICY IF EXISTS "Public read gallery bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload gallery bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete gallery bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage gallery" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view gallery" ON storage.objects;

CREATE POLICY "Public read gallery bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "Admin upload gallery bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND public.is_admin(auth.uid()));

CREATE POLICY "Admin delete gallery bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery' AND public.is_admin(auth.uid()));
