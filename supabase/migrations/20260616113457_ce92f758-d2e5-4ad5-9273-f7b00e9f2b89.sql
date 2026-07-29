DROP POLICY IF EXISTS "Users join clubs" ON public.club_members;

CREATE POLICY "Users join clubs"
ON public.club_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_members.club_id
      AND (
        (c.status = 'approved' AND c.is_public = true)
        OR c.created_by = auth.uid()
      )
  )
);