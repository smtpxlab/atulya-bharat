import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search, Eye } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useBookings } from "../../hooks/useBookings";
import { BookingStatusBadge } from "../../components/bookings/BookingStatusBadge";
import {
  exportBookingsCsv,
  rupees,
  type BookingFilters,
} from "../../services/bookings.service";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function BookingListPage() {
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [gateway, setGateway] = useState("all");
  const [coupon, setCoupon] = useState("");
  const [regStatus, setRegStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filters: BookingFilters = useMemo(
    () => ({
      search,
      paymentStatus,
      gateway,
      couponCode: coupon || undefined,
      registrationStatus: regStatus,
      dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      dateTo: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : undefined,
    }),
    [search, paymentStatus, gateway, coupon, regStatus, dateFrom, dateTo],
  );

  const { data, isLoading, error } = useBookings({ filters, page, pageSize });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleExport = async () => {
    try {
      const csv = await exportBookingsCsv(filters);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bookings-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "Export failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Complete payment ledger of every challenge booking.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Booking #, order id, payment id"
            className="pl-8"
          />
        </div>
        <Input
          value={coupon}
          onChange={(e) => {
            setCoupon(e.target.value);
            setPage(1);
          }}
          placeholder="Coupon code"
        />
        <Select value={paymentStatus} onValueChange={(v) => { setPaymentStatus(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Payment status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={regStatus} onValueChange={(v) => { setRegStatus(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Registration status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All registrations</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gateway} onValueChange={(v) => { setGateway(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Gateway" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All gateways</SelectItem>
            <SelectItem value="razorpay">Razorpay</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Booking #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Challenge</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Coupon</TableHead>
              <TableHead className="text-right">Original</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Final</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Razorpay Payment</TableHead>
              <TableHead>Sig.</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Registration</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={16}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={16} className="py-10 text-center text-muted-foreground">
                  No bookings found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.booking_number}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(r.created_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.profile?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.profile?.email}</div>
                    <div className="text-xs text-muted-foreground">{r.profile?.mobile}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.challenge?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.ticket?.ticket_name ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell className="text-xs">{r.coupon_code ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{rupees(r.original_amount_paise)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{rupees(r.discount_amount_paise)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap font-medium">
                    {rupees(r.final_amount_paise ?? r.amount_paise)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.gateway}
                    {r.gateway_mode && (
                      <span className="ml-1 text-muted-foreground">({r.gateway_mode})</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.razorpay_payment_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.signature_verified ? "Yes" : "No"}
                  </TableCell>
                  <TableCell><BookingStatusBadge status={r.payment_status} /></TableCell>
                  <TableCell className="text-xs">{r.registration?.status ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon">
                      <Link to={`/admin/bookings/${r.id}`} aria-label="View">
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {total} total · page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
