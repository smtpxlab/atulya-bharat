
-- ============================================================
-- Security hardening 1/3 — Tighten public-read RLS on profiles,
-- create safe public view for clubs, and scope USING(true) policies.
-- ============================================================

-- ---------- profiles ----------
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage all profiles" ON public.profiles;

CREATE POLICY "Users read own or admin reads all"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage all profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

REVOKE SELECT ON public.profiles FROM anon;

-- ---------- clubs: safe public view ----------
CREATE OR REPLACE VIEW public.clubs_public
WITH (security_invoker = on) AS
SELECT
  id, slug, name, club_type, description, logo_url, banner_url,
  promoter_id, promoter_name, promoter_city, promoter_state,
  promoter_description, established_at,
  discount_challenge_percent, discount_cart_percent,
  social_links, tags, is_public, status, priority, member_count,
  category_id, created_by, created_at, updated_at
FROM public.clubs;

GRANT SELECT ON public.clubs_public TO anon, authenticated;

-- ---------- testimonials ----------
DROP POLICY IF EXISTS "Testimonials are publicly readable" ON public.testimonials;
CREATE POLICY "Testimonials are publicly readable"
  ON public.testimonials
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------- gallery_images ----------
DROP POLICY IF EXISTS "Public can view gallery images" ON public.gallery_images;
CREATE POLICY "Public can view gallery images"
  ON public.gallery_images
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ---------- milestone_media ----------
DROP POLICY IF EXISTS "Media viewable by everyone" ON public.milestone_media;
CREATE POLICY "Media viewable for enabled milestones"
  ON public.milestone_media
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenge_milestones cm
      WHERE cm.id = milestone_media.milestone_id
        AND (cm.status = true OR public.is_admin(auth.uid()))
    )
  );

-- ---------- club_social_links ----------
DROP POLICY IF EXISTS "Anyone can view club social links" ON public.club_social_links;
CREATE POLICY "Public can view social links for approved public clubs"
  ON public.club_social_links
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_social_links.club_id
        AND c.status = 'approved'
        AND c.is_public = true
    )
    OR public.is_admin(auth.uid())
  );

-- ---------- challenge_tickets ----------
DROP POLICY IF EXISTS "Tickets viewable by everyone" ON public.challenge_tickets;
CREATE POLICY "Tickets viewable for enabled challenges"
  ON public.challenge_tickets
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges ch
      WHERE ch.id = challenge_tickets.challenge_id
        AND (ch.status = true OR public.is_admin(auth.uid()))
    )
  );

-- ---------- coupons / strava_tokens: scope admin policy off `public` role ----------
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons"
  ON public.coupons
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage strava tokens" ON public.strava_tokens;
CREATE POLICY "Admins manage strava tokens"
  ON public.strava_tokens
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
