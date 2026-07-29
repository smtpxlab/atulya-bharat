
-- 1. Extend enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'club_owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
