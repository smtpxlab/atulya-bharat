import { supabase } from "@/integrations/supabase/client";

export type BookingPaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

export interface BookingRow {
  id: string;
  booking_number: string | null;
  created_at: string;
  paid_at: string | null;
  user_id: string;
  challenge_id: string | null;
  ticket_id: string | null;
  registration_id: string | null;
  quantity: number;
  coupon_code: string | null;
  original_amount_paise: number | null;
  discount_amount_paise: number | null;
  final_amount_paise: number | null;
  amount_paise: number;
  currency: string;
  gateway: string;
  gateway_mode: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  signature_verified: boolean;
  payment_status: BookingPaymentStatus;
  status: string;
  gateway_response_json: unknown;
  // joined
  profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
    mobile: string | null;
  } | null;
  challenge?: {
    id: string;
    name: string;
    slug: string;
    distance: number;
    challenge_type: string | null;
    start_at: string | null;
    end_at: string | null;
  } | null;
  ticket?: {
    id: string;
    ticket_name: string;
    ticket_price: number;
  } | null;
  registration?: {
    id: string;
    status: string;
    total_km_logged: number;
    registered_at: string;
    completed_at: string | null;
  } | null;
}

export interface BookingFilters {
  search?: string;
  paymentStatus?: string;
  gateway?: string;
  challengeId?: string;
  couponCode?: string;
  registrationStatus?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function buildSelect(filters: BookingFilters): string {
  // When filtering by registration status we use the !inner modifier so the
  // database (and the exact count) only includes orders whose joined
  // registration matches — pagination and totals stay accurate. (Audit U-4)
  const regJoin =
    filters.registrationStatus && filters.registrationStatus !== "all"
      ? "registration:registrations!inner(id, status, total_km_logged, registered_at, completed_at)"
      : "registration:registrations(id, status, total_km_logged, registered_at, completed_at)";
  return `
    id, booking_number, created_at, paid_at, user_id, challenge_id, ticket_id,
    registration_id, quantity, coupon_code, original_amount_paise,
    discount_amount_paise, final_amount_paise, amount_paise, currency,
    gateway, gateway_mode, razorpay_order_id, razorpay_payment_id,
    signature_verified, payment_status, status, gateway_response_json,
    profile:profiles!orders_user_id_fkey(id, full_name, email, mobile),
    challenge:challenges(id, name, slug, distance, challenge_type, start_at, end_at),
    ticket:challenge_tickets(id, ticket_name, ticket_price),
    ${regJoin}
  `;
}

function applyFilters(q: any, f: BookingFilters) {
  if (f.paymentStatus && f.paymentStatus !== "all") q = q.eq("payment_status", f.paymentStatus);
  if (f.gateway && f.gateway !== "all") q = q.eq("gateway", f.gateway);
  if (f.challengeId) q = q.eq("challenge_id", f.challengeId);
  if (f.couponCode) q = q.ilike("coupon_code", `%${f.couponCode}%`);
  if (f.userId) q = q.eq("user_id", f.userId);
  if (f.dateFrom) q = q.gte("created_at", f.dateFrom);
  if (f.dateTo) q = q.lte("created_at", f.dateTo);
  if (f.registrationStatus && f.registrationStatus !== "all") {
    q = q.eq("registration.status", f.registrationStatus);
  }
  if (f.search) {
    const s = f.search.trim();
    if (s)
      q = q.or(
        `booking_number.ilike.%${s}%,razorpay_order_id.ilike.%${s}%,razorpay_payment_id.ilike.%${s}%`,
      );
  }
  return q;
}

export async function listBookings(params: {
  filters: BookingFilters;
  page: number;
  pageSize: number;
}): Promise<{ rows: BookingRow[]; total: number }> {
  const { filters, page, pageSize } = params;
  let q = supabase
    .from("orders")
    .select(buildSelect(filters), { count: "exact" })
    .order("created_at", { ascending: false });
  q = applyFilters(q, filters);
  q = q.range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as BookingRow[];
  return { rows, total: count ?? 0 };
}

export async function getBooking(id: string): Promise<BookingRow | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(buildSelect({}))
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as BookingRow | null;
}

export async function getBookingsForUser(userId: string): Promise<BookingRow[]> {
  const { rows } = await listBookings({
    filters: { userId },
    page: 1,
    pageSize: 200,
  });
  return rows;
}

export async function getChallengeStats(challengeId: string) {
  const { data, error } = await supabase.rpc("admin_booking_stats" as never, {
    _challenge_id: challengeId,
  } as never);
  if (error) throw error;
  return data as {
    bookings_total: number;
    paid_count: number;
    pending_count: number;
    failed_count: number;
    refunded_count: number;
    revenue_paise: number;
    paid_amount_paise: number;
    pending_amount_paise: number;
    refunded_amount_paise: number;
    registered_users: number;
  };
}

export async function isStravaConnected(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from("strava_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

export function rupees(paise: number | null | undefined): string {
  const n = Number(paise ?? 0) / 100;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function exportBookingsCsv(filters: BookingFilters): Promise<string> {
  const { rows } = await listBookings({ filters, page: 1, pageSize: 5000 });
  const headers = [
    "Booking Number",
    "Booking Date",
    "User Name",
    "Email",
    "Phone",
    "Challenge",
    "Ticket",
    "Quantity",
    "Coupon",
    "Original (INR)",
    "Discount (INR)",
    "Final (INR)",
    "Gateway",
    "Gateway Mode",
    "Razorpay Order ID",
    "Razorpay Payment ID",
    "Signature Verified",
    "Payment Status",
    "Registration Status",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.booking_number,
        r.created_at,
        r.profile?.full_name,
        r.profile?.email,
        r.profile?.mobile,
        r.challenge?.name,
        r.ticket?.ticket_name,
        r.quantity,
        r.coupon_code,
        ((r.original_amount_paise ?? 0) / 100).toFixed(2),
        ((r.discount_amount_paise ?? 0) / 100).toFixed(2),
        ((r.final_amount_paise ?? r.amount_paise) / 100).toFixed(2),
        r.gateway,
        r.gateway_mode,
        r.razorpay_order_id,
        r.razorpay_payment_id,
        r.signature_verified ? "Yes" : "No",
        r.payment_status,
        r.registration?.status,
      ]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n");
}
