import { useQuery } from "@tanstack/react-query";
import { testimonialService } from "@/services/testimonial.service";
import { qk } from "@/lib/queryKeys";

export function usePublicTestimonials() {
  return useQuery({
    queryKey: qk.testimonials.public(),
    queryFn: () => testimonialService.listPublic(),
    staleTime: 5 * 60 * 1000,
  });
}
