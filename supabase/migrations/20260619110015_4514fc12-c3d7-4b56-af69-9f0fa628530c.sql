
-- ============================================================
-- Security hardening 3/3 — Disable Data API listing on public
-- storage buckets. Public CDN URLs continue to work because the
-- buckets themselves remain `public = true`.
-- ============================================================

DROP POLICY IF EXISTS "Public read blog-images" ON storage.objects;
DROP POLICY IF EXISTS "blog-images public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read gallery" ON storage.objects;
DROP POLICY IF EXISTS "Public read gallery bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read challenge assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read challenge-covers" ON storage.objects;
DROP POLICY IF EXISTS "Public read milestone-audio" ON storage.objects;
DROP POLICY IF EXISTS "Public read milestone-images" ON storage.objects;
DROP POLICY IF EXISTS "Club logos read" ON storage.objects;
DROP POLICY IF EXISTS "club-banners public read" ON storage.objects;
