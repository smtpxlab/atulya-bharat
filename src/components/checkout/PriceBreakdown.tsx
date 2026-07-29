import { cn } from "@/lib/utils";

type Props = {
  subtotal: number;
  couponDiscount: number;
  promoterDiscount: number;
  clubDiscount: number;
};

const fmt = (n: number) =>
  `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const Row = ({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) => (
  <div
    className={cn(
      "flex items-center justify-between text-sm",
      emphasis && "pt-3 mt-3 border-t border-border text-base font-semibold text-navy",
    )}
  >
    <span className={cn(!emphasis && "text-muted-foreground")}>{label}</span>
    <span>{fmt(value)}</span>
  </div>
);

export const PriceBreakdown = ({
  subtotal,
  couponDiscount,
  promoterDiscount,
  clubDiscount,
}: Props) => {
  const payable = Math.max(
    0,
    subtotal - couponDiscount - promoterDiscount - clubDiscount,
  );
  return (
    <div className="space-y-1.5">
      <Row label="Price (Item)" value={subtotal} />
      <Row label="Discount" value={couponDiscount} />
      <Row label="Promoter Discount" value={promoterDiscount} />
      <Row label="Club Discount" value={clubDiscount} />
      <Row label="Amount Payable" value={payable} emphasis />
    </div>
  );
};
