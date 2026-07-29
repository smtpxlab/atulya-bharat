CREATE OR REPLACE FUNCTION public.is_club_member(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = _user_id AND club_id = _club_id
  )
$$;

DROP POLICY IF EXISTS "Members view fellow members" ON public.club_members;

CREATE POLICY "Members view fellow members"
ON public.club_members FOR SELECT
TO authenticated
USING (public.is_club_member(auth.uid(), club_id));