GRANT SELECT ON public.notifications TO anon, authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS "Public can view active notifications" ON public.notifications;
CREATE POLICY "Public can view active notifications"
  ON public.notifications
  FOR SELECT
  TO anon, authenticated
  USING (status = true AND is_published = true);