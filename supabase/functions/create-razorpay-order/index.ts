// Creates a Razorpay order for a challenge ticket purchase, applying
// server-trusted discounts. If the final amount is zero (e.g. 100%-off
// coupon), the registration is created immediately and a `free: true`
// response is returned so the client can skip the Razorpay modal.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
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

function freeId() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `ABR-FREE-${ymd}-${rand}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => null);
    const challengeId = body?.challenge_id;
    const ticketId = body?.ticket_id;
    const activityMode = typeof body?.activity_mode === "string" ? body.activity_mode : "any";
    const targetDays = typeof body?.target_days === "number" ? body.target_days : null;
    const couponCode: string | null =
      typeof body?.coupon_code === "string" && body.coupon_code.trim() ? body.coupon_code.trim() : null;
    // SECURITY: promoter/club discounts are never trusted from the client.
    // An entitlement system is not yet implemented, so any value posted by the
    // client is rejected and forced to zero. (Audit P-1)
    const promoterPaise = 0;
    const clubPaise = 0;

    if (typeof challengeId !== "string" || typeof ticketId !== "string") {
      return json({ error: "challenge_id and ticket_id required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Server-trusted price lookup (rupees in schema -> convert to paise).
    const { data: ticket, error: ticketErr } = await admin
      .from("challenge_tickets")
      .select("id, ticket_price, ticket_name, challenge_id")
      .eq("id", ticketId)
      .eq("challenge_id", challengeId)
      .maybeSingle();
    if (ticketErr || !ticket) return json({ error: "Ticket not found" }, 404);

    const subtotalPaise = Math.round(Number(ticket.ticket_price) * 100);
    if (!Number.isFinite(subtotalPaise) || subtotalPaise <= 0) {
      return json({ error: "Invalid ticket price" }, 400);
    }

    // Recompute coupon discount server-side; never trust client values.
    let couponPaise = 0;
    if (couponCode) {
      const { data: validation } = await supabase.rpc("validate_coupon", {
        _code: couponCode,
        _subtotal: subtotalPaise / 100,
      });
      if (validation && (validation as any).valid) {
        couponPaise = Math.max(0, Math.round(Number((validation as any).discount ?? 0) * 100));
      }
    }

    const finalPaise = Math.max(0, subtotalPaise - couponPaise - promoterPaise - clubPaise);

    // Free booking — register immediately, skip Razorpay.
    if (finalPaise === 0) {
      const { data: regResult, error: regRpcErr } = await admin.rpc("register_for_challenge", {
        _user_id: userId,
        _challenge_id: challengeId,
        _ticket_id: ticketId,
        _activity_mode: activityMode,
        _target_days: targetDays,
      });
      if (regRpcErr) {
        console.error("register_for_challenge error", regRpcErr);
        return json({ error: "Failed to create registration" }, 500);
      }
      if (!(regResult as any)?.ok) {
        return json({
          error: "active_challenge_exists",
          message: `You already have an active challenge (${(regResult as any)?.challenge_name ?? "active"}). Complete or wait for it to expire before joining another.`,
          active_challenge_name: (regResult as any)?.challenge_name,
        }, 409);
      }
      const regId = (regResult as any).registration_id as string;
      const txn = freeId();

      await admin.from("orders").insert({
        user_id: userId,
        registration_id: regId,
        challenge_id: challengeId,
        ticket_id: ticketId,
        quantity: 1,
        razorpay_order_id: txn,
        razorpay_payment_id: txn,
        razorpay_signature: "FREE",
        amount_paise: 0,
        original_amount_paise: subtotalPaise,
        final_amount_paise: 0,
        currency: "INR",
        status: "paid",
        payment_status: "paid",
        signature_verified: true,
        gateway: "razorpay",
        gateway_mode: "n/a",
        gateway_response_json: { free: true, coupon_code: couponCode },
        paid_at: new Date().toISOString(),
        subtotal_paise: subtotalPaise,
        coupon_code: couponCode,
        coupon_discount_paise: couponPaise,
        promoter_discount_paise: promoterPaise,
        club_discount_paise: clubPaise,
      });

      if (couponCode) {
        // Atomic, race-safe coupon usage increment. (Audit P-5)
        const { error: couponErr } = await admin.rpc("increment_coupon_usage" as never, {
          _code: couponCode,
        } as never);
        if (couponErr) console.error("Coupon usage increment failed", couponErr);
      }

      return json({
        free: true,
        registration_id: regId,
        transaction_id: txn,
        subtotal_paise: subtotalPaise,
        coupon_discount_paise: couponPaise,
        promoter_discount_paise: promoterPaise,
        club_discount_paise: clubPaise,
        final_paise: 0,
        amount: 0,
        currency: "INR",
      });
    }

    let keyId: string;
    let keySecret: string;
    try {
      ({ keyId, keySecret } = await getRazorpayCreds(admin));
    } catch (e) {
      console.error("Razorpay creds unavailable", e);
      return json({ error: "Razorpay not configured" }, 500);
    }

    const auth = btoa(`${keyId}:${keySecret}`);
    const receipt = `abr_${Date.now()}_${userId.slice(0, 8)}`;

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: finalPaise,
        currency: "INR",
        receipt,
        notes: {
          challenge_id: challengeId,
          ticket_id: ticketId,
          user_id: userId,
          coupon_code: couponCode ?? "",
          coupon_discount_paise: String(couponPaise),
        },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      console.error("Razorpay order error", rzpRes.status, errText);
      return json({ error: "Failed to create Razorpay order" }, 502);
    }
    const order = await rzpRes.json();

    return json({
      free: false,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      ticket_name: ticket.ticket_name,
      subtotal_paise: subtotalPaise,
      coupon_discount_paise: couponPaise,
      promoter_discount_paise: promoterPaise,
      club_discount_paise: clubPaise,
      final_paise: finalPaise,
    });
  } catch (e) {
    console.error("create-razorpay-order error", e);
    return json({ error: "Internal error" }, 500);
  }
});
