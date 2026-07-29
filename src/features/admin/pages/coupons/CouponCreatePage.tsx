import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useCreateCoupon } from "../../hooks/useAdminCoupons";
import CouponForm from "./CouponForm";
import type { CouponFormData } from "@/types/coupon";

export default function CouponCreatePage() {
  const navigate = useNavigate();
  const create = useCreateCoupon();

  const handleSubmit = (values: CouponFormData) => {
    create.mutate(values, {
      onSuccess: () => {
        toast({ title: "Coupon created" });
        navigate("/admin/coupons");
      },
      onError: (e) =>
        toast({
          title: "Create failed",
          description: (e as Error).message,
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Coupon</h1>
        <p className="text-sm text-muted-foreground">
          Create a new discount coupon.
        </p>
      </div>
      <CouponForm
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/admin/coupons")}
      />
    </div>
  );
}
