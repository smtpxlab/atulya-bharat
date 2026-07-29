
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS meta_keywords text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS meta_keywords text[] NOT NULL DEFAULT '{}'::text[];

DROP FUNCTION IF EXISTS public.list_public_clubs();

CREATE OR REPLACE FUNCTION public.list_public_clubs()
 RETURNS TABLE(id uuid, slug text, name text, club_type text, description text, logo_url text, banner_url text, promoter_id uuid, promoter_name text, promoter_city text, promoter_state text, promoter_description text, established_at date, discount_challenge_percent numeric, discount_cart_percent numeric, social_links jsonb, tags text[], is_public boolean, status text, priority integer, member_count integer, category_id uuid, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone, meta_title text, meta_description text, meta_keywords text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, slug, name, club_type, description, logo_url, banner_url,
         promoter_id, promoter_name, promoter_city, promoter_state,
         promoter_description, established_at,
         discount_challenge_percent, discount_cart_percent,
         social_links, tags, is_public, status, priority, member_count,
         category_id, created_by, created_at, updated_at,
         meta_title, meta_description, meta_keywords
  FROM public.clubs
  WHERE status = 'approved' AND is_public = true
  ORDER BY priority DESC, created_at DESC;
$function$;
