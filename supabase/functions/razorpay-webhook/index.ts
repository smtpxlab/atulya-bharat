// Razorpay webhook receiver. Verifies HMAC-SHA256 signature against
// RAZORPAY_WEBHOOK_SECRET and processes payment.captured, payment.failed,
// and refund.processed events idempotently.
//
// Endpoint is public (no JWT). All trust comes from the signature header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { createHmac, timingSafeEqual } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-razorpay-signature",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function verifySignature(secret: string, raw: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET not configured");
    return json({ error: "Webhook secret not configured" }, 503);
  }

  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) return json({ error: "Missing signature" }, 401);

  const raw = await req.text();
  if (!verifySignature(secret, raw, signature)) {
    console.warn("razorpay-webhook: invalid signature");
    return json({ error: "Invalid signature" }, 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const event: string = payload?.event ?? "";
  const eventId: string | undefined =
    payload?.id ??
    payload?.payload?.payment?.entity?.id ??
    payload?.payload?.refund?.entity?.id;

  console.log("razorpay-webhook event", { event, eventId });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (event === "payment.captured" || event === "payment.authorized") {
      const p = payload?.payload?.payment?.entity;
      if (!p?.order_id || !p?.id) return json({ ok: true, skipped: "no_ids" });

      // Find the order we created.
      const { data: order } = await admin
        .from("orders")
        .select("id, payment_status, razorpay_payment_id, registration_id, user_id")
        .eq("razorpay_order_id", p.order_id)
        .maybeSingle();

      if (!order) {
        // Order row may not exist yet because verify-razorpay-payment hasn't
        // run. Log so a follow-up reconciliation job can pick it up.
        console.warn("payment.captured for unknown order", {
          razorpay_order_id: p.order_id,
          razorpay_payment_id: p.id,
        });
        return json({ ok: true, deferred: true });
      }

      if (order.payment_status === "paid") {
        return json({ ok: true, idempotent: true });
      }

      const { error: updErr } = await admin
        .from("orders")
        .update({
          razorpay_payment_id: p.id,
          payment_status: "paid",
          status: "paid",
          paid_at: new Date(p.created_at ? p.created_at * 1000 : Date.now()).toISOString(),
          gateway_response_json: { source: "webhook", event, payment: p },
        })
        .eq("id", order.id);
      if (updErr) console.error("order update failed", updErr);
      return json({ ok: true, updated: true });
    }

    if (event === "payment.failed") {
      const p = payload?.payload?.payment?.entity;
      if (!p?.order_id) return json({ ok: true, skipped: "no_order_id" });

      const { data: order } = await admin
        .from("orders")
        .select("id, payment_status")
        .eq("razorpay_order_id", p.order_id)
        .maybeSingle();
      if (!order) return json({ ok: true, deferred: true });
      if (order.payment_status === "paid") {
        // Already captured by another event — do not overwrite.
        return json({ ok: true, idempotent: true });
      }
      await admin
        .from("orders")
        .update({
          payment_status: "failed",
          status: "failed",
          gateway_response_json: {
            source: "webhook",
            event,
            error_code: p.error_code,
            error_description: p.error_description,
            error_reason: p.error_reason,
          },
        })
        .eq("id", order.id);
      return json({ ok: true, updated: true });
    }

    if (event === "refund.processed" || event === "refund.created") {
      const r = payload?.payload?.refund?.entity;
      if (!r?.payment_id) return json({ ok: true, skipped: "no_payment_id" });

      const { data: order } = await admin
        .from("orders")
        .select("id, payment_status")
        .eq("razorpay_payment_id", r.payment_id)
        .maybeSingle();
      if (!order) return json({ ok: true, deferred: true });

      await admin
        .from("orders")
        .update({
          payment_status: "refunded",
          status: "refunded",
          gateway_response_json: { source: "webhook", event, refund: r },
        })
        .eq("id", order.id);
      return json({ ok: true, updated: true });
    }

    return json({ ok: true, ignored: event });
  } catch (e) {
    console.error("razorpay-webhook handler error", e);
    return json({ error: "Internal error" }, 500);
  }
});
