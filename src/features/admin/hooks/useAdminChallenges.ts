import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createChallenge,
  deleteChallenge,
  getAdminChallengeById,
  listAdminChallenges,
  toggleChallengeStatus,
  updateChallenge,
  type AdminChallengeListParams,
} from "@/services/challenge.service";
import { qk } from "@/lib/queryKeys";
import { toast } from "@/hooks/use-toast";
import type { ChallengeFormValues } from "@/features/challenges/schemas/challenge.schema";

export const useAdminChallenges = (params: AdminChallengeListParams = {}) =>
  useQuery({
    queryKey: qk.challenges.admin.list(params as Record<string, unknown>),
    queryFn: () => listAdminChallenges(params),
  });

export const useAdminChallenge = (id: string | undefined) =>
  useQuery({
    queryKey: qk.challenges.admin.detail(id ?? ""),
    queryFn: () => getAdminChallengeById(id as string),
    enabled: !!id,
  });

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: qk.challenges.all });
};

export const useCreateChallenge = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChallengeFormValues) => createChallenge(payload),
    onSuccess: () => {
      invalidateAll(qc);
      toast({ title: "Challenge created successfully." });
    },
    onError: (e: any) =>
      toast({
        title: "Could not create challenge",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      }),
  });
};

export const useUpdateChallenge = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ChallengeFormValues }) =>
      updateChallenge(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: qk.challenges.admin.detail(vars.id) });
      invalidateAll(qc);
      toast({ title: "Challenge updated successfully." });
    },
    onError: (e: any) =>
      toast({
        title: "Could not update challenge",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      }),
  });
};

export const useDeleteChallenge = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteChallenge(id),
    onSuccess: () => {
      invalidateAll(qc);
      toast({ title: "Challenge deleted." });
    },
    onError: (e: any) =>
      toast({
        title: "Could not delete challenge",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      }),
  });
};

export const useToggleChallengeStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: boolean }) =>
      toggleChallengeStatus(id, status),
    onSuccess: () => invalidateAll(qc),
    onError: (e: any) =>
      toast({
        title: "Could not update status",
        description: e?.message ?? "Unknown error",
        variant: "destructive",
      }),
  });
};
