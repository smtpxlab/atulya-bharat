import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBooking, useStravaConnected } from "../../hooks/useBookings";
import { BookingStatusBadge } from "../../components/bookings/BookingStatusBadge";
import { GatewayResponseViewer } from "../../components/bookings/GatewayResponseViewer";
import { rupees } from "../../services/bookings.service";
import { supabase } from "@/integrations/supabase/client";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b py-2 text-sm last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words">{value ?? "—"}</div>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: b, isLoading } = useBooking(id);
  const { data: stravaConnected } = useStravaConnected(b?.user_id);

  // Pull completion % from the canonical progress RPC so admin matches user view. (Audit U-3)
  const { data: progress } = useQuery({
    queryKey: ["admin", "registration-progress", b?.registration_id],
    enabled: !!b?.registration_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("challenge_progress_by_registration" as never, {
          _registration_id: b!.registration_id!,
        } as never);
      if (error) throw error;
      const d: any = data ?? null;
      const row = Array.isArray(d) ? (d[0] ?? null) : d;
      return row as { distance_logged_km: number; pct_complete: number } | null;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!b) {
    return <div className="text-sm text-muted-foreground">Booking not found.</div>;
  }

  const reg = b.registration;
  const ch = b.challenge;
  const t = b.ticket;
  const p = b.profile;
  const completionPct = progress ? Math.min(100, Math.round(Number(progress.pct_complete))) : 0;
  const loggedKm = progress ? Number(progress.distance_logged_km) : Number(reg?.total_km_logged ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/admin/bookings">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {b.booking_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            Created {format(new Date(b.created_at), "dd MMM yyyy HH:mm")}
          </p>
        </div>
        <BookingStatusBadge status={b.payment_status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Booking</CardTitle></CardHeader>
          <CardContent>
            <Row label="Booking Number" value={b.booking_number} />
            <Row label="Booking ID" value={<code className="text-xs">{b.id}</code>} />
            <Row label="Created" value={format(new Date(b.created_at), "dd MMM yyyy HH:mm")} />
            <Row label="Quantity" value={b.quantity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent>
            <Row label="Name" value={p?.full_name} />
            <Row label="Email" value={p?.email} />
            <Row label="Phone" value={p?.mobile} />
            <Row label="User ID" value={<code className="text-xs">{b.user_id}</code>} />
            <Row
              label="Registered"
              value={reg?.registered_at ? format(new Date(reg.registered_at), "dd MMM yyyy") : "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Challenge</CardTitle></CardHeader>
          <CardContent>
            <Row
              label="Challenge"
              value={
                ch ? (
                  <Link className="underline" to={`/admin/challenges/${ch.id}/edit`}>
                    {ch.name}
                  </Link>
                ) : "—"
              }
            />
            <Row label="Distance" value={ch ? `${ch.distance} km` : "—"} />
            <Row label="Type" value={ch?.challenge_type} />
            <Row label="Start" value={ch?.start_at ? format(new Date(ch.start_at), "dd MMM yyyy") : "—"} />
            <Row label="End" value={ch?.end_at ? format(new Date(ch.end_at), "dd MMM yyyy") : "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ticket</CardTitle></CardHeader>
          <CardContent>
            <Row label="Name" value={t?.ticket_name} />
            <Row label="Quantity" value={b.quantity} />
            <Row label="Original" value={rupees(b.original_amount_paise)} />
            <Row label="Discount" value={rupees(b.discount_amount_paise)} />
            <Row label="Final Paid" value={<strong>{rupees(b.final_amount_paise ?? b.amount_paise)}</strong>} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
          <CardContent>
            <Row label="Gateway" value={b.gateway} />
            <Row label="Mode" value={b.gateway_mode} />
            <Row label="Status" value={<BookingStatusBadge status={b.payment_status} />} />
            <Row label="Paid at" value={b.paid_at ? format(new Date(b.paid_at), "dd MMM yyyy HH:mm") : "—"} />
            <Row label="Razorpay Order ID" value={<code className="text-xs">{b.razorpay_order_id}</code>} />
            <Row label="Razorpay Payment ID" value={<code className="text-xs">{b.razorpay_payment_id}</code>} />
            <Row label="Signature Verified" value={b.signature_verified ? "Yes" : "No"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Coupon</CardTitle></CardHeader>
          <CardContent>
            <Row label="Code" value={b.coupon_code} />
            <Row label="Discount" value={rupees(b.discount_amount_paise)} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Registration</CardTitle></CardHeader>
          <CardContent>
            <Row
              label="Registration ID"
              value={
                reg ? (
                  <code className="text-xs">{reg.id}</code>
                ) : "—"
              }
            />
            <Row label="Status" value={reg?.status} />
            <Row label="Distance Logged" value={reg ? `${loggedKm.toFixed(2)} km` : "—"} />
            <Row label="Completion %" value={`${completionPct}%`} />
            <Row
              label="Completed Date"
              value={reg?.completed_at ? format(new Date(reg.completed_at), "dd MMM yyyy") : "—"}
            />
            <Row label="Certificate" value={reg?.status === "completed" ? "Available" : "Pending"} />
            <Row label="Strava Connected" value={stravaConnected ? "Yes" : "No"} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <GatewayResponseViewer data={b.gateway_response_json} />
        </div>
      </div>
    </div>
  );
}
