import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useUserRegistration = (challengeId: string | undefined | null) => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["registrations", "mine-for-challenge", user?.id, challengeId],
    enabled: !!user?.id && !!challengeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("id, status, ticket_id, activity_mode, target_days")
        .eq("user_id", user!.id)
        .eq("challenge_id", challengeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    registration: query.data ?? null,
    isBooked:
      !!query.data &&
      query.data.status !== ("abandoned" as typeof query.data.status),
    isLoading: query.isLoading,
  };
};
