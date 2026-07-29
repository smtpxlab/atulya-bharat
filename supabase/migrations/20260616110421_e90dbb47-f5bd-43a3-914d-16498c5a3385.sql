
DROP POLICY IF EXISTS "club-banners public read" ON storage.objects;
DROP POLICY IF EXISTS "club-banners authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "club-banners owner update" ON storage.objects;
DROP POLICY IF EXISTS "club-banners owner delete" ON storage.objects;

CREATE POLICY "club-banners public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'club-banners');

CREATE POLICY "club-banners authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-banners');

CREATE POLICY "club-banners owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'club-banners' AND (owner = auth.uid() OR public.is_admin(auth.uid())));

CREATE POLICY "club-banners owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'club-banners' AND (owner = auth.uid() OR public.is_admin(auth.uid())));
