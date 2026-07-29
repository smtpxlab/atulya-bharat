
-- RLS policies for profile-images bucket
-- Public read (bucket is public), owner-only writes, admin override.

CREATE POLICY "profile_images_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'profile-images');

CREATE POLICY "profile_images_user_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "profile_images_user_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-images' AND owner = auth.uid())
WITH CHECK (bucket_id = 'profile-images' AND owner = auth.uid());

CREATE POLICY "profile_images_user_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-images' AND owner = auth.uid());

CREATE POLICY "profile_images_admin_all"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'profile-images' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'profile-images' AND public.is_admin(auth.uid()));
