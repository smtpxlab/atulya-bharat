
DROP INDEX IF EXISTS public.idx_blog_published;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS meta_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.blog_posts
SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END
WHERE status IS NULL;

ALTER TABLE public.blog_posts
  ALTER COLUMN status SET DEFAULT 'draft',
  ALTER COLUMN status SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_status_check') THEN
    ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_status_check CHECK (status IN ('draft','published'));
  END IF;
END $$;

-- Recreate is_published as generated column. Drop dependent policy first.
DROP POLICY IF EXISTS "Published posts viewable by everyone" ON public.blog_posts;
ALTER TABLE public.blog_posts DROP COLUMN is_published;
ALTER TABLE public.blog_posts
  ADD COLUMN is_published boolean GENERATED ALWAYS AS (status = 'published') STORED;

CREATE POLICY "Published posts viewable by everyone"
ON public.blog_posts FOR SELECT
USING (is_published = true);

CREATE INDEX IF NOT EXISTS idx_blog_status ON public.blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_published ON public.blog_posts (is_published, published_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "blog-images public read" ON storage.objects;
DROP POLICY IF EXISTS "blog-images admin insert" ON storage.objects;
DROP POLICY IF EXISTS "blog-images admin update" ON storage.objects;
DROP POLICY IF EXISTS "blog-images admin delete" ON storage.objects;

CREATE POLICY "blog-images public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');

CREATE POLICY "blog-images admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'blog-images' AND public.is_admin(auth.uid()));

CREATE POLICY "blog-images admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'blog-images' AND public.is_admin(auth.uid()));

CREATE POLICY "blog-images admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'blog-images' AND public.is_admin(auth.uid()));
