import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRegistrationDetail } from "@/services/registration-detail.service";

export const registrationKeys = {
  all: ["registration"] as const,
  detail: (id: string) => ["registration", id] as const,
};

export function useRegistrationDetail(registrationId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: registrationKeys.detail(registrationId ?? "none"),
    enabled: !!registrationId && !!userId,
    queryFn: () => getRegistrationDetail(registrationId!, userId!),
    staleTime: 30_000,
  });
}

export function useInvalidateRegistration() {
  const qc = useQueryClient();
  return (registrationId: string) =>
    qc.invalidateQueries({ queryKey: registrationKeys.detail(registrationId) });
}
