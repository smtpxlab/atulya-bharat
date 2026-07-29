import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getActiveRegistration, type ActiveRegistration } from "@/services/challenge-progress.service";

/** Returns the user's current active registration, or null. */
export const useActiveRegistration = () => {
  const { user } = useAuth();
  const query = useQuery<ActiveRegistration | null>({
    queryKey: ["registrations", "active", user?.id],
    enabled: !!user?.id,
    queryFn: async () => (user ? await getActiveRegistration(user.id) : null),
    staleTime: 30_000,
  });
  return {
    active: query.data ?? null,
    isLoading: query.isLoading,
  };
};
