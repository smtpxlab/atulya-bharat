import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminPagesService,
  type AdminPageListParams,
} from "../services/page.admin.service";
import type { AdminPageInput, AdminPageUpdate } from "@/schemas/page.schema";
import { qk } from "@/lib/queryKeys";

export function useAdminPages(params: AdminPageListParams) {
  return useQuery({
    queryKey: qk.pages.admin.list(params as Record<string, unknown>),
    queryFn: () => adminPagesService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useAdminPage(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.pages.admin.detail(id) : ["admin", "pages", "detail", "none"],
    queryFn: () => adminPagesService.get(id!),
    enabled: !!id,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.pages.admin.all });
  qc.invalidateQueries({ queryKey: qk.pages.all });
}

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminPageInput) => adminPagesService.create(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdatePage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminPageUpdate) => adminPagesService.update(id, input),
    onSuccess: (data) => {
      invalidateAll(qc);
      qc.setQueryData(qk.pages.admin.detail(id), data);
    },
  });
}

export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPagesService.remove(id),
    onSuccess: () => invalidateAll(qc),
  });
}
