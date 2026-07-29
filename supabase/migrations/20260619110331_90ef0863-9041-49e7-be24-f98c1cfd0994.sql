
DROP POLICY IF EXISTS "Users read own or admin reads all" ON public.profiles;

CREATE POLICY "Profiles readable to self admin or fellow club members"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.club_members cm_self
      JOIN public.club_members cm_other
        ON cm_other.club_id = cm_self.club_id
      WHERE cm_self.user_id = auth.uid()
        AND cm_other.user_id = profiles.id
    )
  );
