// Mock checkout endpoint — mirrors verify-razorpay-payment but skips
// gateway signature verification. Writes the same `registrations` and
// `orders` records production expects so dashboard/admin views read
// the booking without any branching.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mockId() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `ABR-MOCK-${ymd}-${rand}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    // Gate: only admins (or when explicitly enabled via env) may use the mock checkout.
    const adminClientForGate = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const mockEnabled = (Deno.env.get("MOCK_BOOKING_ENABLED") ?? "").toLowerCase() === "true";
    if (!mockEnabled) {
      const { data: isAdmin } = await adminClientForGate.rpc("is_admin", { _user_id: userId });
      if (!isAdmin) {
        return json({ error: "forbidden", message: "Mock checkout is disabled" }, 403);
      }
    }

    const body = await req.json().catch(() => ({}));
    const {
      challenge_id,
      ticket_id,
      activity_mode,
      target_days,
      coupon_code,
      coupon_discount_paise,
      promoter_discount_paise,
      club_discount_paise,
    } = body ?? {};

    if (!challenge_id || !ticket_id) {
      return json({ error: "challenge_id and ticket_id required" }, 400);
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Re-fetch ticket to trust price (in rupees in this schema)
    const { data: ticket, error: ticketErr } = await admin
      .from("challenge_tickets")
      .select("id, ticket_price, challenge_id")
      .eq("id", ticket_id)
      .eq("challenge_id", challenge_id)
      .maybeSingle();
    if (ticketErr || !ticket) return json({ error: "Ticket not found" }, 404);

    const subtotalPaise = Math.round(Number(ticket.ticket_price) * 100);
    // Recompute coupon discount server-side via validate_coupon RPC — never trust client values.
    let couponPaise = 0;
    if (typeof coupon_code === "string" && coupon_code.trim()) {
      const { data: validation } = await userClient.rpc("validate_coupon", {
        _code: coupon_code.trim(),
        _subtotal: subtotalPaise / 100,
      });
      if (validation && (validation as any).valid) {
        couponPaise = Math.max(0, Math.round(Number((validation as any).discount ?? 0) * 100));
      }
    }
    const promoterPaise = Math.max(0, Number(promoter_discount_paise ?? 0) | 0);
    const clubPaise = Math.max(0, Number(club_discount_paise ?? 0) | 0);
    const finalPaise = Math.max(
      0,
      subtotalPaise - couponPaise - promoterPaise - clubPaise,
    );

    // Enforce one-active-challenge rule via RPC.
    const { data: regResult, error: regRpcErr } = await admin.rpc("register_for_challenge", {
      _user_id: userId,
      _challenge_id: challenge_id,
      _ticket_id: ticket_id,
      _activity_mode: activity_mode ?? "any",
      _target_days: typeof target_days === "number" ? target_days : null,
    });
    if (regRpcErr) {
      console.error("register_for_challenge error", regRpcErr);
      return json({ error: "Failed to create registration" }, 500);
    }
    if (!regResult?.ok) {
      return json({
        error: "active_challenge_exists",
        message: `You already have an active challenge (${regResult?.challenge_name ?? "active"}). Complete or wait for it to expire before joining another.`,
        active_challenge_name: regResult?.challenge_name,
      }, 409);
    }
    const registration = { id: regResult.registration_id as string };

    const txn = mockId();
    const { error: orderErr } = await admin.from("orders").insert({
      user_id: userId,
      registration_id: registration.id,
      razorpay_order_id: txn,
      razorpay_payment_id: txn,
      razorpay_signature: "MOCK",
      amount_paise: finalPaise,
      currency: "INR",
      status: "paid",
      paid_at: new Date().toISOString(),
      subtotal_paise: subtotalPaise,
      coupon_code: coupon_code ?? null,
      coupon_discount_paise: couponPaise,
      promoter_discount_paise: promoterPaise,
      club_discount_paise: clubPaise,
    });
    if (orderErr) {
      console.error("Order insert error", orderErr);
    }

    // Atomic, race-safe coupon usage increment. (Audit P-5)
    if (!orderErr && coupon_code) {
      const { error: couponErr } = await admin.rpc("increment_coupon_usage" as never, {
        _code: String(coupon_code),
      } as never);
      if (couponErr) console.error("Coupon usage increment failed", couponErr);
    }

    return json({
      success: true,
      registration_id: registration.id,
      transaction_id: txn,
      amount_paise: finalPaise,
    });
  } catch (e) {
    console.error("complete-mock-booking error", e);
    return json({ error: "Internal error" }, 500);
  }
});
