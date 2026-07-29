import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import FullPageLoader from "@/components/FullPageLoader";

const buildRedirect = (loc: { pathname: string; search: string; hash: string }) =>
  encodeURIComponent(loc.pathname + loc.search + loc.hash);

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { initialized, user } = useAuth();
  const location = useLocation();

  if (!initialized) return <FullPageLoader />;

  if (!user) {
    return <Navigate to={`/login?redirect=${buildRedirect(location)}`} replace />;
  }

  return <>{children}</>;
};
