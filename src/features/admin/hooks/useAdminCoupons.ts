import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { couponService } from "@/services/coupon.service";
import { qk } from "@/lib/queryKeys";
import type { CouponFormData, CouponListParams } from "@/types/coupon";

export function useCoupons(params: CouponListParams) {
  return useQuery({
    queryKey: qk.coupons.list(params as Record<string, unknown>),
    queryFn: () => couponService.listCoupons(params),
    placeholderData: (prev) => prev,
  });
}

export function useCoupon(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.coupons.detail(id) : ["coupons", "detail", "none"],
    queryFn: () => couponService.getCouponById(id!),
    enabled: !!id,
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CouponFormData) => couponService.createCoupon(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.coupons.all }),
  });
}

export function useUpdateCoupon(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CouponFormData) => couponService.updateCoupon(id, input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.coupons.all });
      qc.setQueryData(qk.coupons.detail(id), data);
    },
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => couponService.deleteCoupon(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.coupons.all }),
  });
}

export function useToggleCouponStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      couponService.toggleCouponStatus(id, next),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.coupons.all });
      qc.setQueryData(qk.coupons.detail(data.id), data);
    },
  });
}
