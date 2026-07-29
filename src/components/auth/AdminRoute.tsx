import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import FullPageLoader from "@/components/FullPageLoader";

export const AdminRoute = ({ children }: { children: ReactNode }) => {
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

  if (!isAdmin) {
    toast({
      title: "Access denied",
      description: "You do not have permission to view this page.",
      variant: "destructive",
    });
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
