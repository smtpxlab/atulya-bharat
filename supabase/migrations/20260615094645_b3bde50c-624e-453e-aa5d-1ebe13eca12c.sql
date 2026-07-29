
-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Helpers
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS app_role[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::app_role[])
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'super_admin'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::app_role
  )
$$;

-- Swap admin policies to use is_admin(). Drop + recreate by original names.
DO $$
DECLARE
  r RECORD;
  policy_map text[][] := ARRAY[
    ['activity_logs', 'Admins manage activity', 'ALL'],
    ['blog_posts', 'Admins manage posts', 'ALL'],
    ['blog_posts', 'Admins view all posts', 'SELECT'],
    ['challenge_tickets', 'Admins manage tickets', 'ALL'],
    ['challenges', 'Admins manage challenges', 'ALL'],
    ['challenges', 'Admins view all challenges', 'SELECT'],
    ['club_members', 'Admins manage memberships', 'ALL'],
    ['clubs', 'Admins manage clubs', 'ALL'],
    ['milestones', 'Admins manage milestones', 'ALL'],
    ['milestone_media', 'Admins manage media', 'ALL'],
    ['gallery_images', 'Admins manage gallery', 'ALL'],
    ['testimonials', 'Admins manage testimonials', 'ALL'],
    ['testimonials', 'Admins view all testimonials', 'SELECT'],
    ['contact_enquiries', 'Admins view enquiries', 'SELECT'],
    ['contact_enquiries', 'Admins update enquiries', 'UPDATE'],
    ['contact_enquiries', 'Admins delete enquiries', 'DELETE'],
    ['registrations', 'Admins manage registrations', 'ALL'],
    ['orders', 'Admins manage orders', 'ALL'],
    ['orders', 'Admins view all orders', 'SELECT'],
    ['user_milestones', 'Admins manage user milestones', 'ALL'],
    ['profiles', 'Admins manage profiles', 'ALL'],
    ['profiles', 'Admins view all profiles', 'SELECT'],
    ['user_roles', 'Admins manage roles', 'ALL'],
    ['user_roles', 'Admins view all roles', 'SELECT']
  ];
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY policy_map LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = pair[1] AND policyname = pair[2]
    ) THEN
      EXECUTE format('DROP POLICY %I ON public.%I', pair[2], pair[1]);
      IF pair[3] = 'ALL' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))',
          pair[2], pair[1]
        );
      ELSIF pair[3] = 'SELECT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_admin(auth.uid()))',
          pair[2], pair[1]
        );
      ELSIF pair[3] = 'UPDATE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))',
          pair[2], pair[1]
        );
      ELSIF pair[3] = 'DELETE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_admin(auth.uid()))',
          pair[2], pair[1]
        );
      END IF;
    END IF;
  END LOOP;
END $$;
