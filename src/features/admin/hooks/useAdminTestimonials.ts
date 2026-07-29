import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { testimonialService } from "@/services/testimonial.service";
import { qk } from "@/lib/queryKeys";
import type { TestimonialFormData, TestimonialListParams } from "@/types/testimonial";

export function useTestimonialsAdmin(params: TestimonialListParams) {
  return useQuery({
    queryKey: qk.testimonials.adminList(params as Record<string, unknown>),
    queryFn: () => testimonialService.listAdmin(params),
    placeholderData: (prev) => prev,
  });
}

export function useTestimonial(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.testimonials.detail(id) : ["testimonials", "detail", "none"],
    queryFn: () => testimonialService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TestimonialFormData) => testimonialService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.testimonials.all }),
  });
}

export function useUpdateTestimonial(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TestimonialFormData) => testimonialService.update(id, input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.testimonials.all });
      qc.setQueryData(qk.testimonials.detail(id), data);
    },
  });
}

export function useDeleteTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testimonialService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.testimonials.all }),
  });
}
