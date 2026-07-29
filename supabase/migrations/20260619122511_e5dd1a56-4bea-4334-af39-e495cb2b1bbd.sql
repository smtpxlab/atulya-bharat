DROP POLICY IF EXISTS "Users join clubs" ON public.club_members;
CREATE POLICY "Users join clubs" ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated create clubs" ON public.clubs;
CREATE POLICY "Authenticated create clubs" ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);