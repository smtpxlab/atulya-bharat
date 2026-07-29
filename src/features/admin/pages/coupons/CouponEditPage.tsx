import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoupon, useUpdateCoupon } from "../../hooks/useAdminCoupons";
import CouponForm from "./CouponForm";
import type { CouponFormData } from "@/types/coupon";

export default function CouponEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useCoupon(id);
  const update = useUpdateCoupon(id ?? "");

  const handleSubmit = (values: CouponFormData) => {
    update.mutate(values, {
      onSuccess: () => {
        toast({ title: "Coupon updated" });
        navigate("/admin/coupons");
      },
      onError: (e) =>
        toast({
          title: "Update failed",
          description: (e as Error).message,
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Coupon</h1>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <CouponForm
          submitLabel="Save"
          submitting={update.isPending}
          initial={{
            coupon_name: data.coupon_name,
            coupon_type: data.coupon_type,
            coupon_value: Number(data.coupon_value),
            minimum_order_amount: Number(data.minimum_order_amount),
            coupon_frequency: data.coupon_frequency,
            details: data.details ?? "",
            expires_at: data.expires_at,
            status: data.status,
          }}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/admin/coupons")}
        />
      )}
    </div>
  );
}
