import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { faqService } from "@/services/faq.service";
import { qk } from "@/lib/queryKeys";
import type { FaqFormData, FaqListParams } from "@/types/faq";

export function useFaqsAdmin(params: FaqListParams) {
  return useQuery({
    queryKey: qk.faqs.adminList(params as Record<string, unknown>),
    queryFn: () => faqService.listAdmin(params),
    placeholderData: (prev) => prev,
  });
}

export function useFaq(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.faqs.detail(id) : ["faqs", "detail", "none"],
    queryFn: () => faqService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FaqFormData) => faqService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.faqs.all }),
  });
}

export function useUpdateFaq(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FaqFormData) => faqService.update(id, input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.faqs.all });
      qc.setQueryData(qk.faqs.detail(id), data);
    },
  });
}

export function useDeleteFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => faqService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.faqs.all }),
  });
}

export function useToggleFaqStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      faqService.toggleStatus(id, next),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.faqs.all });
      qc.setQueryData(qk.faqs.detail(data.id), data);
    },
  });
}
