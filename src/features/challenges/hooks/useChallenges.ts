import { useQuery } from "@tanstack/react-query";
import { listChallenges } from "@/services/challenge.service";
import { qk } from "@/lib/queryKeys";

export const useChallenges = () =>
  useQuery({
    queryKey: qk.challenges.list(),
    queryFn: listChallenges,
  });
