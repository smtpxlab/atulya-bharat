// Verifies a Razorpay payment HMAC signature, then records the order
// and creates an active registration. Auth required.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { createHmac } from "node:crypto";
import { getRazorpayCreds } from "../_shared/razorpay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => null);
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      challenge_id,
      ticket_id,
      activity_mode,
      target_days,
    } = body ?? {};

    const couponCode: string | null =
      typeof body?.coupon_code === "string" && body.coupon_code.trim() ? body.coupon_code.trim() : null;
    // SECURITY: promoter/club discounts are never trusted from the client.
    // Forced to zero pending a server-side entitlement system. (Audit P-1)
    const promoterPaise = 0;
    const clubPaise = 0;

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      typeof challenge_id !== "string" ||
      typeof ticket_id !== "string"
    ) {
      return json({ error: "Missing required fields" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let keySecret: string;
    try {
      ({ keySecret } = await getRazorpayCreds(admin));
    } catch (e) {
      console.error("Razorpay creds unavailable", e);
      return json({ error: "Razorpay not configured" }, 500);
    }

    const expected = createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      console.warn("Signature mismatch for order", razorpay_order_id);
      return json({ error: "Invalid signature" }, 400);
    }

    // Idempotency: if this Razorpay order was already verified, return the
    // existing registration instead of double-charging through the active-challenge
    // guard (which would otherwise misreport a successful retry as needing a refund).
    const { data: existingPaid } = await admin
      .from("orders")
      .select("id, registration_id, payment_status")
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("payment_status", "paid")
      .maybeSingle();
    if (existingPaid?.registration_id) {
      return json({ success: true, registration_id: existingPaid.registration_id, idempotent: true });
    }

    // Re-fetch ticket to trust price (rupees -> paise).
    const { data: ticket, error: ticketErr } = await admin
      .from("challenge_tickets")
      .select("id, ticket_price, challenge_id")
      .eq("id", ticket_id)
      .eq("challenge_id", challenge_id)
      .maybeSingle();
    if (ticketErr || !ticket) return json({ error: "Ticket not found" }, 404);

    const subtotalPaise = Math.round(Number(ticket.ticket_price) * 100);

    // Recompute coupon discount server-side; never trust client values.
    let couponPaise = 0;
    if (couponCode) {
      const { data: validation } = await userClient.rpc("validate_coupon", {
        _code: couponCode,
        _subtotal: subtotalPaise / 100,
      });
      if (validation && (validation as any).valid) {
        couponPaise = Math.max(0, Math.round(Number((validation as any).discount ?? 0) * 100));
      }
    }
    const finalPaise = Math.max(0, subtotalPaise - couponPaise - promoterPaise - clubPaise);

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
    // Detect Razorpay key mode from keyId prefix (rzp_test_/rzp_live_).
    let keyId = "";
    try {
      ({ keyId } = await getRazorpayCreds(admin));
    } catch { /* ignore */ }
    const gatewayMode = keyId.startsWith("rzp_live_") ? "live" : "test";

    if (!(regResult as any)?.ok) {
      console.warn("Active challenge exists for user", userId, regResult);
      await admin.from("orders").insert({
        user_id: userId,
        registration_id: null,
        challenge_id: challenge_id,
        ticket_id: ticket_id,
        quantity: 1,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount_paise: finalPaise,
        original_amount_paise: subtotalPaise,
        final_amount_paise: finalPaise,
        currency: "INR",
        status: "refund_pending",
        payment_status: "refunded",
        signature_verified: true,
        gateway: "razorpay",
        gateway_mode: gatewayMode,
        gateway_response_json: { reason: "active_challenge_exists", regResult },
        paid_at: new Date().toISOString(),
        subtotal_paise: subtotalPaise,
        coupon_code: couponCode,
        coupon_discount_paise: couponPaise,
        promoter_discount_paise: promoterPaise,
        club_discount_paise: clubPaise,
      });
      return json({
        error: "active_challenge_exists",
        message: `You already have an active challenge (${(regResult as any)?.challenge_name ?? "active"}). Complete or wait for it to expire before joining another.`,
        active_challenge_name: (regResult as any)?.challenge_name,
        refund_pending: true,
      }, 409);
    }
    const registration = { id: (regResult as any).registration_id as string };

    const { error: orderErr } = await admin.from("orders").insert({
      user_id: userId,
      registration_id: registration.id,
      challenge_id: challenge_id,
      ticket_id: ticket_id,
      quantity: 1,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount_paise: finalPaise,
      original_amount_paise: subtotalPaise,
      final_amount_paise: finalPaise,
      currency: "INR",
      status: "paid",
      payment_status: "paid",
      signature_verified: true,
      gateway: "razorpay",
      gateway_mode: gatewayMode,
      gateway_response_json: {
        razorpay_order_id,
        razorpay_payment_id,
        verified_at: new Date().toISOString(),
      },
      paid_at: new Date().toISOString(),
      subtotal_paise: subtotalPaise,
      coupon_code: couponCode,
      coupon_discount_paise: couponPaise,
      promoter_discount_paise: promoterPaise,
      club_discount_paise: clubPaise,
    });
    if (orderErr) {
      console.error("Order insert error", orderErr);
    }

    if (!orderErr && couponCode) {
      // Atomic, race-safe coupon usage increment. (Audit P-5)
      const { error: couponErr } = await admin.rpc("increment_coupon_usage" as never, {
        _code: couponCode,
      } as never);
      if (couponErr) console.error("Coupon usage increment failed", couponErr);
    }

    return json({ success: true, registration_id: registration.id });
  } catch (e) {
    console.error("verify-razorpay-payment error", e);
    return json({ error: "Internal error" }, 500);
  }
});
