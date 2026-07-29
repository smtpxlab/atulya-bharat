GRANT EXECUTE ON FUNCTION public.is_admin(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid)       TO authenticated;