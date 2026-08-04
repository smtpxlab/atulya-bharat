/**
 * Express re-implementations of public.validate_coupon and
 * public.increment_coupon_usage. Auth is enforced by the caller (route /
 * RPC layer); nothing here reads auth.uid().
 */
import type { Knex } from "knex";
import { getDb } from "../../config/db";

export type CouponValidation =
  | { valid: true; coupon_name: string; coupon_type: string; discount: number }
  | { valid: false; reason: string; minimum_order_amount?: number };

const round2 = (v: number) => Math.round(v * 100) / 100;

export async function validateCoupon(
  code: string | null | undefined,
  subtotal: number | null | undefined,
  db: Knex = getDb(),
): Promise<CouponValidation> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { valid: false, reason: "invalid_code" };
  if (subtotal === null || subtotal === undefined || !Number.isFinite(Number(subtotal)) || Number(subtotal) < 0)
    return { valid: false, reason: "invalid_subtotal" };

  const amount = Number(subtotal);
  const c = await db("coupons")
    .whereRaw("upper(coupon_name) = upper(?)", [trimmed])
    .first<any>();

  if (!c || !c.status) return { valid: false, reason: "not_found" };
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now())
    return { valid: false, reason: "expired" };
  if (Number(c.coupon_frequency) > 0 && Number(c.coupon_used) >= Number(c.coupon_frequency))
    return { valid: false, reason: "exhausted" };

  const minOrder = Number(c.minimum_order_amount ?? 0);
  if (amount < minOrder)
    return { valid: false, reason: "min_order", minimum_order_amount: minOrder };

  const raw =
    c.coupon_type === "percent" ? (amount * Number(c.coupon_value)) / 100 : Number(c.coupon_value);
  const discount = Math.min(Math.max(0, round2(raw)), amount);

  return {
    valid: true,
    coupon_name: c.coupon_name,
    coupon_type: c.coupon_type,
    discount,
  };
}

export type CouponUsageResult =
  | { ok: true; coupon_id: string; coupon_used: number; coupon_frequency: number }
  | { ok: false; reason: string };

/** Mirrors public.increment_coupon_usage — atomic, only bumps redeemable coupons. */
export async function incrementCouponUsage(
  code: string | null | undefined,
  db: Knex = getDb(),
): Promise<CouponUsageResult> {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty_code" };

  const result = await db.raw(
    `update public.coupons
        set coupon_used = coupon_used + 1
      where id = (
        select id from public.coupons
         where coupon_name ilike ?
           and status = true
           and (expires_at is null or expires_at >= now())
           and (coupon_frequency = 0 or coupon_used < coupon_frequency)
         limit 1
      )
      returning id, coupon_used, coupon_frequency`,
    [trimmed],
  );
  const row = ((result as any).rows ?? result)[0];
  if (!row) return { ok: false, reason: "not_available" };
  return {
    ok: true,
    coupon_id: row.id,
    coupon_used: Number(row.coupon_used),
    coupon_frequency: Number(row.coupon_frequency),
  };
}
