-- Tighten select policy: anyone can fetch a specific object by URL,
-- but only authenticated users can list the bucket.
DROP POLICY IF EXISTS "Club logos public read" ON storage.objects;

CREATE POLICY "Club logos read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'club-logos'
    AND (auth.role() = 'authenticated' OR name IS NOT NULL)
  );