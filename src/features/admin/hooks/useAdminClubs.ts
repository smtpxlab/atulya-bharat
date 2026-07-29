import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminClubsService,
  type AdminClubListParams,
} from "../services/club.admin.service";
import type { AdminClubInput, AdminClubUpdate } from "@/schemas/club.schema";
import { adminQk } from "./useAdminDashboard";
import { qk } from "@/lib/queryKeys";

export function useClubMemberReport() {
  return useQuery({
    queryKey: qk.adminClubs.memberReport,
    queryFn: () => adminClubsService.getClubMemberReport(),
    staleTime: 30_000,
  });
}

export function useAdminClubs(params: AdminClubListParams) {
  return useQuery({
    queryKey: adminQk.clubs.list(params as Record<string, unknown>),
    queryFn: () => adminClubsService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useAdminClub(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminQk.clubs.detail(id) : ["admin", "clubs", "detail", "none"],
    queryFn: () => adminClubsService.get(id!),
    enabled: !!id,
  });
}

export function useAdminClubMembers(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminQk.clubs.members(id) : ["admin", "clubs", "members", "none"],
    queryFn: () => adminClubsService.members(id!),
    enabled: !!id,
  });
}

export function useAdminClubReports() {
  return useQuery({
    queryKey: adminQk.clubs.reports,
    queryFn: () => adminClubsService.reports(),
    staleTime: 60_000,
  });
}

export function useAdminClubReportSummary() {
  return useQuery({
    queryKey: adminQk.clubs.reportSummary,
    queryFn: () => adminClubsService.exportSummary(),
    staleTime: 30_000,
  });
}

export function useAdminClubReportMembers() {
  return useQuery({
    queryKey: adminQk.clubs.reportMembers,
    queryFn: () => adminClubsService.exportMembers(),
    staleTime: 30_000,
  });
}

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: adminQk.clubs.all });
  qc.invalidateQueries({ queryKey: qk.clubs.all });
};

export function useCreateAdminClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminClubInput) => adminClubsService.create(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateAdminClub(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminClubUpdate) => adminClubsService.update(id, input),
    onSuccess: (data) => {
      invalidateAll(qc);
      qc.setQueryData(adminQk.clubs.detail(id), data);
    },
  });
}

export function useDeleteAdminClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminClubsService.remove(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useApproveClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminClubsService.approve(id),
    onSuccess: (data) => {
      invalidateAll(qc);
      qc.setQueryData(adminQk.clubs.detail(data.id), data);
    },
  });
}

export function useRejectClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminClubsService.reject(id),
    onSuccess: (data) => {
      invalidateAll(qc);
      qc.setQueryData(adminQk.clubs.detail(data.id), data);
    },
  });
}

export function useToggleClubVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; is_public: boolean }) =>
      adminClubsService.toggleVisibility(args.id, args.is_public),
    onSuccess: (data) => {
      invalidateAll(qc);
      qc.setQueryData(adminQk.clubs.detail(data.id), data);
    },
  });
}

export function useUpdateClubPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; priority: number }) =>
      adminClubsService.updatePriority(args.id, args.priority),
    onSuccess: () => invalidateAll(qc),
  });
}
