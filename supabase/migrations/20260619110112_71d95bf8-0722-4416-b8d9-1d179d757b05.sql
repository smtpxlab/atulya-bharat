
-- Replace the security_invoker view with an owner-privileged view
-- (so anon/auth users can read it after we drop the public-read
-- policy on the base clubs table).
DROP VIEW IF EXISTS public.clubs_public;

CREATE VIEW public.clubs_public AS
SELECT
  id, slug, name, club_type, description, logo_url, banner_url,
  promoter_id, promoter_name, promoter_city, promoter_state,
  promoter_description, established_at,
  discount_challenge_percent, discount_cart_percent,
  social_links, tags, is_public, status, priority, member_count,
  category_id, created_by, created_at, updated_at
FROM public.clubs
WHERE status = 'approved' AND is_public = true;

ALTER VIEW public.clubs_public SET (security_invoker = off);
GRANT SELECT ON public.clubs_public TO anon, authenticated;

-- Remove the wide public-read policy on the base clubs table
-- (PII columns were leaking through it). Owners and admins keep
-- access via their existing policies.
DROP POLICY IF EXISTS "Public approved clubs viewable" ON public.clubs;
