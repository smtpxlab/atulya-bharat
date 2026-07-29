/**
 * Thin selector wrapper over the Redux `auth` slice so existing
 * `useAuth()` consumers keep working after the architecture reset.
 *
 * Sign-out only calls supabase.auth.signOut(); cache cleanup is handled by
 * AuthBootstrap on the SIGNED_OUT event (so public queries are preserved).
 */
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppSelector } from "@/store";
import type { AppRole } from "@/store/slices/authSlice";

export type { AppRole };

export const useAuth = () => {
  const { user, session, loading, rolesLoading, roles, initialized } =
    useAppSelector((s) => s.auth);

  return useMemo(() => {
    const hasRole = (role: AppRole) => roles.includes(role);
    const hasAnyRole = (rs: AppRole[]) => rs.some((r) => roles.includes(r));
    return {
      user,
      session,
      loading,
      rolesLoading,
      initialized,
      roles,
      isAdmin: hasAnyRole(["admin", "super_admin"]),
      isSuperAdmin: hasRole("super_admin"),
      hasRole,
      hasAnyRole,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [user, session, loading, rolesLoading, initialized, roles]);
};
