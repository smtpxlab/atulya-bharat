import { useQuery } from "@tanstack/react-query";
import { faqService } from "@/services/faq.service";
import { qk } from "@/lib/queryKeys";

export function usePublicFaqs() {
  return useQuery({
    queryKey: qk.faqs.public(),
    queryFn: () => faqService.listPublicEnabled(),
    staleTime: 5 * 60 * 1000,
  });
}
