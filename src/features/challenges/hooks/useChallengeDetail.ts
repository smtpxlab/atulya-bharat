import { useQuery } from "@tanstack/react-query";
import { getChallengeDetails } from "@/services/challenge.service";
import { qk } from "@/lib/queryKeys";

export const useChallengeDetail = (slug: string | undefined) =>
  useQuery({
    queryKey: qk.challenges.detail(slug ?? ""),
    queryFn: () => getChallengeDetails(slug as string),
    enabled: !!slug,
  });
