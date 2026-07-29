/**
 * Razorpay service — port of the three Supabase edge functions
 * (create-razorpay-order, verify-razorpay-payment, razorpay-webhook).
 *
 * Business rules preserved:
 *   - Prices come from the DB (`challenge_tickets`), never the client.
 *   - Coupons are validated via `validate_coupon()` PL/pgSQL function.
 *   - Promoter/club discounts are forced to zero (Audit P-1).
 *   - Free bookings register immediately via `register_for_challenge()`.
 *   - Signature verification uses HMAC-SHA256 with timing-safe compare.
 *   - Webhook events are idempotent (payment.captured, payment.failed,
 *     refund.processed/created).
 */
import Razorpay from "razorpay";
import crypto from "node:crypto";
import { Knex } from "knex";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { getDb } from "../../config/db";
import { HttpError } from "../../utils/httpError";

let client: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (client) return client;
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new HttpError(503, "RAZORPAY_NOT_CONFIGURED", "Razorpay is not configured");
  }
  client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}

export function gatewayMode(): "live" | "test" {
  return env.RAZORPAY_KEY_ID.startsWith("rzp_live_") ? "live" : "test";
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface CreateOrderInput {
  userId: string;
  challengeId: string;
  ticketId: string;
  activityMode?: string;
  targetDays?: number | null;
  couponCode?: string | null;
}

export interface CreateOrderResult {
  free: boolean;
  order_id?: string;
  amount: number;
  currency: string;
  key_id?: string;
  ticket_name?: string;
  subtotal_paise: number;
  coupon_discount_paise: number;
  promoter_discount_paise: number;
  club_discount_paise: number;
  final_paise: number;
  registration_id?: string;
  transaction_id?: string;
}

function freeTxnId() {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `ABR-FREE-${ymd}-${Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0")}`;
}

/**
 * Recompute a coupon discount using the DB's `validate_coupon(_code, _subtotal)`
 * SECURITY DEFINER function. Never trust client-side discount values.
 */
async function computeCouponPaise(
  db: Knex,
  couponCode: string | null,
  subtotalPaise: number,
): Promise<number> {
  if (!couponCode) return 0;
  const result = await db.raw<{ rows: { validate_coupon: { valid: boolean; discount: number } }[] }>(
    "select validate_coupon(?, ?) as validate_coupon",
    [couponCode, subtotalPaise / 100],
  );
  const v = result.rows?.[0]?.validate_coupon;
  if (!v?.valid) return 0;
  return Math.max(0, Math.round(Number(v.discount ?? 0) * 100));
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const db = getDb();
  const { userId, challengeId, ticketId, couponCode = null } = input;
  const activityMode = input.activityMode ?? "any";
  const targetDays = input.targetDays ?? null;

  const ticket = await db("challenge_tickets")
    .select("id", "ticket_price", "ticket_name", "challenge_id")
    .where({ id: ticketId, challenge_id: challengeId })
    .first();
  if (!ticket) throw new HttpError(404, "TICKET_NOT_FOUND", "Ticket not found");

  const subtotalPaise = Math.round(Number(ticket.ticket_price) * 100);
  if (!Number.isFinite(subtotalPaise) || subtotalPaise <= 0) {
    throw new HttpError(400, "INVALID_PRICE", "Invalid ticket price");
  }

  const couponPaise = await computeCouponPaise(db, couponCode, subtotalPaise);
  const finalPaise = Math.max(0, subtotalPaise - couponPaise);

  if (finalPaise === 0) {
    const rpc = await db.raw<{ rows: { register_for_challenge: any }[] }>(
      "select register_for_challenge(?, ?, ?, ?, ?) as register_for_challenge",
      [userId, challengeId, ticketId, activityMode, targetDays],
    );
    const regResult = rpc.rows?.[0]?.register_for_challenge;
    if (!regResult?.ok) {
      throw new HttpError(409, "ACTIVE_CHALLENGE_EXISTS", regResult?.challenge_name ?? "active", regResult);
    }
    const regId = regResult.registration_id as string;
    const txn = freeTxnId();
    await db("orders").insert({
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
      paid_at: new Date(),
      subtotal_paise: subtotalPaise,
      coupon_code: couponCode,
      coupon_discount_paise: couponPaise,
      promoter_discount_paise: 0,
      club_discount_paise: 0,
    });
    if (couponCode) {
      await db.raw("select increment_coupon_usage(?)", [couponCode]).catch((err) =>
        logger.warn({ err }, "increment_coupon_usage failed"),
      );
    }
    return {
      free: true,
      registration_id: regId,
      transaction_id: txn,
      subtotal_paise: subtotalPaise,
      coupon_discount_paise: couponPaise,
      promoter_discount_paise: 0,
      club_discount_paise: 0,
      final_paise: 0,
      amount: 0,
      currency: "INR",
    };
  }

  const rzp = getRazorpay();
  const receipt = `abr_${Date.now()}_${userId.slice(0, 8)}`;
  const order = await rzp.orders.create({
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
  });

  return {
    free: false,
    order_id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
    key_id: env.RAZORPAY_KEY_ID,
    ticket_name: ticket.ticket_name,
    subtotal_paise: subtotalPaise,
    coupon_discount_paise: couponPaise,
    promoter_discount_paise: 0,
    club_discount_paise: 0,
    final_paise: finalPaise,
  };
}

export interface VerifyPaymentInput {
  userId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  challenge_id: string;
  ticket_id: string;
  activity_mode?: string;
  target_days?: number | null;
  coupon_code?: string | null;
}

export async function verifyAndRecordPayment(input: VerifyPaymentInput) {
  const db = getDb();
  const { userId } = input;

  if (!verifyPaymentSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature)) {
    throw new HttpError(400, "INVALID_SIGNATURE", "Invalid signature");
  }

  // Idempotency check
  const existing = await db("orders")
    .select("id", "registration_id", "payment_status")
    .where({ razorpay_order_id: input.razorpay_order_id, payment_status: "paid" })
    .first();
  if (existing?.registration_id) {
    return { success: true, registration_id: existing.registration_id, idempotent: true };
  }

  const ticket = await db("challenge_tickets")
    .select("id", "ticket_price", "challenge_id")
    .where({ id: input.ticket_id, challenge_id: input.challenge_id })
    .first();
  if (!ticket) throw new HttpError(404, "TICKET_NOT_FOUND", "Ticket not found");

  const subtotalPaise = Math.round(Number(ticket.ticket_price) * 100);
  const couponPaise = await computeCouponPaise(db, input.coupon_code ?? null, subtotalPaise);
  const finalPaise = Math.max(0, subtotalPaise - couponPaise);

  const rpc = await db.raw<{ rows: { register_for_challenge: any }[] }>(
    "select register_for_challenge(?, ?, ?, ?, ?) as register_for_challenge",
    [userId, input.challenge_id, input.ticket_id, input.activity_mode ?? "any", input.target_days ?? null],
  );
  const regResult = rpc.rows?.[0]?.register_for_challenge;
  const mode = gatewayMode();

  if (!regResult?.ok) {
    // Record as refund_pending so an operator can issue the refund manually.
    await db("orders").insert({
      user_id: userId,
      registration_id: null,
      challenge_id: input.challenge_id,
      ticket_id: input.ticket_id,
      quantity: 1,
      razorpay_order_id: input.razorpay_order_id,
      razorpay_payment_id: input.razorpay_payment_id,
      razorpay_signature: input.razorpay_signature,
      amount_paise: finalPaise,
      original_amount_paise: subtotalPaise,
      final_amount_paise: finalPaise,
      currency: "INR",
      status: "refund_pending",
      payment_status: "refunded",
      signature_verified: true,
      gateway: "razorpay",
      gateway_mode: mode,
      gateway_response_json: { reason: "active_challenge_exists", regResult },
      paid_at: new Date(),
      subtotal_paise: subtotalPaise,
      coupon_code: input.coupon_code ?? null,
      coupon_discount_paise: couponPaise,
      promoter_discount_paise: 0,
      club_discount_paise: 0,
    });
    throw new HttpError(409, "ACTIVE_CHALLENGE_EXISTS", "Active challenge exists", {
      active_challenge_name: regResult?.challenge_name,
      refund_pending: true,
    });
  }

  const registrationId = regResult.registration_id as string;
  await db("orders").insert({
    user_id: userId,
    registration_id: registrationId,
    challenge_id: input.challenge_id,
    ticket_id: input.ticket_id,
    quantity: 1,
    razorpay_order_id: input.razorpay_order_id,
    razorpay_payment_id: input.razorpay_payment_id,
    razorpay_signature: input.razorpay_signature,
    amount_paise: finalPaise,
    original_amount_paise: subtotalPaise,
    final_amount_paise: finalPaise,
    currency: "INR",
    status: "paid",
    payment_status: "paid",
    signature_verified: true,
    gateway: "razorpay",
    gateway_mode: mode,
    gateway_response_json: {
      razorpay_order_id: input.razorpay_order_id,
      razorpay_payment_id: input.razorpay_payment_id,
      verified_at: new Date().toISOString(),
    },
    paid_at: new Date(),
    subtotal_paise: subtotalPaise,
    coupon_code: input.coupon_code ?? null,
    coupon_discount_paise: couponPaise,
    promoter_discount_paise: 0,
    club_discount_paise: 0,
  });
  if (input.coupon_code) {
    await db.raw("select increment_coupon_usage(?)", [input.coupon_code]).catch((err) =>
      logger.warn({ err }, "increment_coupon_usage failed"),
    );
  }
  return { success: true, registration_id: registrationId };
}

/**
 * Idempotently apply a Razorpay webhook event. Handles:
 *   payment.captured / payment.authorized  → mark order paid
 *   payment.failed                         → mark order failed
 *   refund.processed / refund.created      → mark order refunded
 */
export async function applyWebhookEvent(payload: any): Promise<{ ok: true; result: string }> {
  const db = getDb();
  const event: string = payload?.event ?? "";

  if (event === "payment.captured" || event === "payment.authorized") {
    const p = payload?.payload?.payment?.entity;
    if (!p?.order_id || !p?.id) return { ok: true, result: "skipped_no_ids" };
    const order = await db("orders")
      .select("id", "payment_status")
      .where({ razorpay_order_id: p.order_id })
      .first();
    if (!order) return { ok: true, result: "deferred" };
    if (order.payment_status === "paid") return { ok: true, result: "idempotent" };
    await db("orders").where({ id: order.id }).update({
      razorpay_payment_id: p.id,
      payment_status: "paid",
      status: "paid",
      paid_at: p.created_at ? new Date(p.created_at * 1000) : new Date(),
      gateway_response_json: { source: "webhook", event, payment: p },
    });
    return { ok: true, result: "updated" };
  }

  if (event === "payment.failed") {
    const p = payload?.payload?.payment?.entity;
    if (!p?.order_id) return { ok: true, result: "skipped_no_order_id" };
    const order = await db("orders")
      .select("id", "payment_status")
      .where({ razorpay_order_id: p.order_id })
      .first();
    if (!order) return { ok: true, result: "deferred" };
    if (order.payment_status === "paid") return { ok: true, result: "idempotent" };
    await db("orders").where({ id: order.id }).update({
      payment_status: "failed",
      status: "failed",
      gateway_response_json: {
        source: "webhook",
        event,
        error_code: p.error_code,
        error_description: p.error_description,
        error_reason: p.error_reason,
      },
    });
    return { ok: true, result: "updated" };
  }

  if (event === "refund.processed" || event === "refund.created") {
    const r = payload?.payload?.refund?.entity;
    if (!r?.payment_id) return { ok: true, result: "skipped_no_payment_id" };
    const order = await db("orders")
      .select("id", "payment_status")
      .where({ razorpay_payment_id: r.payment_id })
      .first();
    if (!order) return { ok: true, result: "deferred" };
    await db("orders").where({ id: order.id }).update({
      payment_status: "refunded",
      status: "refunded",
      gateway_response_json: { source: "webhook", event, refund: r },
    });
    return { ok: true, result: "updated" };
  }

  return { ok: true, result: `ignored_${event}` };
}

/** Issue a Razorpay refund for a payment. */
export async function refundPayment(paymentId: string, amountPaise?: number, notes?: Record<string, string>) {
  const rzp = getRazorpay();
  return rzp.payments.refund(paymentId, {
    amount: amountPaise,
    notes,
    speed: "normal",
  });
}
