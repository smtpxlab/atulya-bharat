
DROP VIEW IF EXISTS public.clubs_public;

CREATE OR REPLACE FUNCTION public.list_public_clubs()
RETURNS TABLE (
  id uuid, slug text, name text, club_type text, description text,
  logo_url text, banner_url text, promoter_id uuid, promoter_name text,
  promoter_city text, promoter_state text, promoter_description text,
  established_at date,
  discount_challenge_percent numeric, discount_cart_percent numeric,
  social_links jsonb, tags text[], is_public boolean, status text,
  priority integer, member_count integer, category_id uuid,
  created_by uuid, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, name, club_type, description, logo_url, banner_url,
         promoter_id, promoter_name, promoter_city, promoter_state,
         promoter_description, established_at,
         discount_challenge_percent, discount_cart_percent,
         social_links, tags, is_public, status, priority, member_count,
         category_id, created_by, created_at, updated_at
  FROM public.clubs
  WHERE status = 'approved' AND is_public = true
  ORDER BY priority DESC, created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_public_club_by_slug(_slug text)
RETURNS TABLE (
  id uuid, slug text, name text, club_type text, description text,
  logo_url text, banner_url text, promoter_id uuid, promoter_name text,
  promoter_city text, promoter_state text, promoter_description text,
  established_at date,
  discount_challenge_percent numeric, discount_cart_percent numeric,
  social_links jsonb, tags text[], is_public boolean, status text,
  priority integer, member_count integer, category_id uuid,
  created_by uuid, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, name, club_type, description, logo_url, banner_url,
         promoter_id, promoter_name, promoter_city, promoter_state,
         promoter_description, established_at,
         discount_challenge_percent, discount_cart_percent,
         social_links, tags, is_public, status, priority, member_count,
         category_id, created_by, created_at, updated_at
  FROM public.clubs
  WHERE slug = _slug AND status = 'approved' AND is_public = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_clubs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_club_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_clubs() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_club_by_slug(text) TO anon, authenticated;
