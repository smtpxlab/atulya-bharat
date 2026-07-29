import { Badge } from "@/components/ui/badge";
import type { BookingPaymentStatus } from "../../services/bookings.service";

const VARIANT: Record<BookingPaymentStatus, string> = {
  paid: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  refunded: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

export function BookingStatusBadge({ status }: { status: string }) {
  const s = (status as BookingPaymentStatus) ?? "pending";
  return (
    <Badge variant="outline" className={VARIANT[s] ?? VARIANT.pending}>
      {s}
    </Badge>
  );
}
