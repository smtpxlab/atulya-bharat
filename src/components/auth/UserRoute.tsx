import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import FullPageLoader from "@/components/FullPageLoader";

/**
 * Gate for the public user dashboard.
 * - Not signed in → /login?redirect=...
 * - Admin → /admin (only once roles resolve)
 * - While session/roles resolve → centered loader (chrome stays mounted)
 */
export const UserRoute = ({ children }: { children: ReactNode }) => {
  const { initialized, rolesLoading, user, isAdmin } = useAuth();
  const location = useLocation();

  if (!initialized) return <FullPageLoader />;

  if (!user) {
    const redirect = encodeURIComponent(
      location.pathname + location.search + location.hash,
    );
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (rolesLoading) return <FullPageLoader />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  return <>{children}</>;
};
