import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tag, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { couponCodeSchema } from "@/schemas/checkout.schema";

export type AppliedCoupon = {
  coupon_name: string;
  coupon_type: "percent" | "fixed";
  discount: number; // rupees
};

type Props = {
  subtotal: number;
  applied: AppliedCoupon | null;
  onChange: (next: AppliedCoupon | null) => void;
};

const REASON_MESSAGES: Record<string, string> = {
  auth_required: "Please sign in to apply a coupon.",
  invalid_code: "Invalid coupon code.",
  invalid_subtotal: "Invalid order amount.",
  not_found: "Coupon not found.",
  expired: "This coupon has expired.",
  exhausted: "This coupon has reached its usage limit.",
};

export const CouponPanel = ({ subtotal, applied, onChange }: Props) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    const parsed = couponCodeSchema.safeParse(code);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid coupon code");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("validate_coupon" as never, {
        _code: parsed.data,
        _subtotal: subtotal,
      } as never);
      if (error) throw error;
      const result = (data ?? {}) as {
        valid: boolean;
        reason?: string;
        minimum_order_amount?: number;
        coupon_name?: string;
        coupon_type?: "percent" | "fixed";
        discount?: number;
      };
      if (!result.valid) {
        if (result.reason === "min_order") {
          toast.error(
            `Minimum order ₹${result.minimum_order_amount} required for this coupon.`,
          );
        } else {
          toast.error(REASON_MESSAGES[result.reason ?? ""] ?? "Could not apply coupon.");
        }
        return;
      }
      onChange({
        coupon_name: result.coupon_name!,
        coupon_type: result.coupon_type!,
        discount: Number(result.discount ?? 0),
      });
      toast.success(`Coupon ${result.coupon_name} applied.`);
      setCode("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not apply coupon");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg text-navy">Have a coupon?</h2>
      </header>

      {applied ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-success/10 px-4 py-3">
          <div className="min-w-0">
            <Badge className="rounded-full bg-success text-white hover:bg-success">
              {applied.coupon_name}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              You saved ₹{applied.discount.toFixed(2)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            className="rounded-full min-h-11"
          >
            <X className="mr-1 h-4 w-4" /> Remove
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter coupon code"
            className="rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
          />
          <Button
            onClick={apply}
            disabled={busy || !code.trim()}
            className="rounded-full min-h-11 px-6"
          >
            Apply
          </Button>
        </div>
      )}
    </section>
  );
};
