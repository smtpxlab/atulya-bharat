import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { newsletterService } from "@/services/newsletter.service";
import type { NewsletterListParams, NewsletterStatus } from "@/types/newsletter";

const KEY = ["admin", "newsletter"] as const;

export function useNewsletterSubscribers(params: NewsletterListParams) {
  return useQuery({
    queryKey: [...KEY, "list", params],
    queryFn: () => newsletterService.listAdmin(params),
    placeholderData: (prev) => prev,
  });
}

export function useNewsletterStats() {
  return useQuery({
    queryKey: [...KEY, "stats"],
    queryFn: () => newsletterService.getStats(),
  });
}

export function useSetSubscriberStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: NewsletterStatus }) =>
      newsletterService.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => newsletterService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
