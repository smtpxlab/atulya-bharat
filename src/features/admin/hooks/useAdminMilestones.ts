import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMilestone,
  deleteMilestone,
  getMilestoneById,
  listMilestones,
  toggleMilestoneStatus,
  updateMilestone,
  type ListMilestonesParams,
} from "@/services/challengeMilestone.service";
import type { MilestoneFormValues } from "@/types/milestone";
import { qk } from "@/lib/queryKeys";

export function useMilestones(params: ListMilestonesParams) {
  return useQuery({
    queryKey: qk.milestones.list(params as Record<string, unknown>),
    queryFn: () => listMilestones(params),
    placeholderData: (prev) => prev,
  });
}

export function useMilestone(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.milestones.detail(id) : ["milestones", "detail", "none"],
    queryFn: () => getMilestoneById(id!),
    enabled: !!id,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MilestoneFormValues) => createMilestone(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.milestones.all }),
  });
}

export function useUpdateMilestone(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<MilestoneFormValues>) => updateMilestone(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.milestones.all });
    },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMilestone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.milestones.all }),
  });
}

export function useToggleMilestoneStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: boolean }) =>
      toggleMilestoneStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.milestones.all }),
  });
}
