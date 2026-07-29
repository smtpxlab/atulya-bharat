-- Split anon+authenticated SELECT policies that call is_admin() in their qual.
-- Anon does not (and should not) have EXECUTE on is_admin, so the OR branch
-- aborts the whole query with 42501 for signed-out visitors. Fix: anon gets
-- only the public predicate; authenticated keeps the admin OR.

-- challenge_tickets
DROP POLICY IF EXISTS "Tickets viewable for enabled challenges" ON public.challenge_tickets;

CREATE POLICY "Tickets viewable to anon for enabled challenges"
  ON public.challenge_tickets FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.challenges ch
    WHERE ch.id = challenge_tickets.challenge_id AND ch.status = true
  ));

CREATE POLICY "Tickets viewable to authenticated for enabled or admin"
  ON public.challenge_tickets FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges ch
    WHERE ch.id = challenge_tickets.challenge_id
      AND (ch.status = true OR public.is_admin(auth.uid()))
  ));

-- milestone_media
DROP POLICY IF EXISTS "Media viewable for enabled milestones" ON public.milestone_media;

CREATE POLICY "Media viewable to anon for enabled milestones"
  ON public.milestone_media FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.challenge_milestones cm
    WHERE cm.id = milestone_media.milestone_id AND cm.status = true
  ));

CREATE POLICY "Media viewable to authenticated for enabled or admin"
  ON public.milestone_media FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenge_milestones cm
    WHERE cm.id = milestone_media.milestone_id
      AND (cm.status = true OR public.is_admin(auth.uid()))
  ));

-- club_social_links
DROP POLICY IF EXISTS "Public can view social links for approved public clubs" ON public.club_social_links;

CREATE POLICY "Social links viewable to anon for approved public clubs"
  ON public.club_social_links FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = club_social_links.club_id
      AND c.status = 'approved' AND c.is_public = true
  ));

CREATE POLICY "Social links viewable to authenticated for approved or admin"
  ON public.club_social_links FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_social_links.club_id
        AND c.status = 'approved' AND c.is_public = true
    )
    OR public.is_admin(auth.uid())
  );