
-- 1. Add columns to clubs
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS club_type text,
  ADD COLUMN IF NOT EXISTS promoter_name text,
  ADD COLUMN IF NOT EXISTS promoter_email text,
  ADD COLUMN IF NOT EXISTS promoter_phone text,
  ADD COLUMN IF NOT EXISTS promoter_address text,
  ADD COLUMN IF NOT EXISTS promoter_city text,
  ADD COLUMN IF NOT EXISTS promoter_state text,
  ADD COLUMN IF NOT EXISTS promoter_dob date,
  ADD COLUMN IF NOT EXISTS promoter_description text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill created_by from promoter_id when missing
UPDATE public.clubs SET created_by = promoter_id WHERE created_by IS NULL AND promoter_id IS NOT NULL;

-- 2. Status workflow migration
ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_status_check;
UPDATE public.clubs SET status = CASE
  WHEN status = 'published' THEN 'approved'
  WHEN status = 'draft' THEN 'pending'
  WHEN status = 'suspended' THEN 'rejected'
  ELSE status END;
ALTER TABLE public.clubs ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.clubs ADD CONSTRAINT clubs_status_check CHECK (status IN ('pending','approved','rejected'));

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_clubs_priority_created ON public.clubs (priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clubs_status_public ON public.clubs (status, is_public);

-- 4. updated_at trigger
DROP TRIGGER IF EXISTS trg_clubs_updated_at ON public.clubs;
CREATE TRIGGER trg_clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enforce pending/private for non-admin inserts
CREATE OR REPLACE FUNCTION public.clubs_enforce_pending_for_users()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    NEW.status := 'pending';
    NEW.is_public := false;
    NEW.priority := 0;
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_clubs_enforce_pending ON public.clubs;
CREATE TRIGGER trg_clubs_enforce_pending BEFORE INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.clubs_enforce_pending_for_users();

-- 6. Reset clubs RLS policies
DROP POLICY IF EXISTS "Admins manage clubs" ON public.clubs;
DROP POLICY IF EXISTS "Authenticated users create clubs" ON public.clubs;
DROP POLICY IF EXISTS "Members view own private club" ON public.clubs;
DROP POLICY IF EXISTS "Promoters update own clubs" ON public.clubs;
DROP POLICY IF EXISTS "Promoters view own clubs" ON public.clubs;
DROP POLICY IF EXISTS "Public clubs viewable by everyone" ON public.clubs;

CREATE POLICY "Public approved clubs viewable" ON public.clubs
  FOR SELECT USING (status = 'approved' AND is_public = true);

CREATE POLICY "Creator views own club" ON public.clubs
  FOR SELECT TO authenticated USING (auth.uid() = created_by OR auth.uid() = promoter_id);

CREATE POLICY "Authenticated create clubs" ON public.clubs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by OR auth.uid() = promoter_id);

CREATE POLICY "Creator updates own pending club" ON public.clubs
  FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by OR auth.uid() = promoter_id) AND status = 'pending')
  WITH CHECK ((auth.uid() = created_by OR auth.uid() = promoter_id) AND status = 'pending');

CREATE POLICY "Admins manage clubs" ON public.clubs
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 7. Tighten club_members join policy
DROP POLICY IF EXISTS "Users join clubs" ON public.club_members;
CREATE POLICY "Users join clubs" ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_id AND c.status = 'approved' AND c.is_public = true
    )
  );

-- 8. Ensure grants
GRANT SELECT ON public.clubs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
