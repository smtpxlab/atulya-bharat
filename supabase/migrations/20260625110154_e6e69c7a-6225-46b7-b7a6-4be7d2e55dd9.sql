
-- Public read
CREATE POLICY "participation_photos_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'participation-photos');

-- Owner write (folder = user_id)
CREATE POLICY "participation_photos_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'participation-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "participation_photos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'participation-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'participation-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "participation_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'participation-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
