import type { NextFunction, Request, Response } from "express";

/**
 * Fields that must never leave the API, regardless of caller role.
 *
 * - `access_token` / `refresh_token` / `strava_*_token` — `strava_tokens` rows.
 * - `key_secret` — `payment_gateways` rows (hidden even from admins).
 * - `password_hash` / `token_hash` — auth tables.
 *
 * NOTE: the auth domain issues its own session tokens using camelCase
 * (`accessToken` / `refreshToken`), so those are unaffected.
 */
export const SECRET_FIELDS = new Set([
  "access_token",
  "refresh_token",
  "key_secret",
  "client_secret",
  "password_hash",
  "token_hash",
  "razorpay_signature",
]);

export function stripSecrets<T>(value: T, seen = new WeakSet<object>()): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripSecrets(v, seen)) as unknown as T;
  }
  if (value && typeof value === "object") {
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    if (seen.has(value as object)) return value;
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_FIELDS.has(k)) continue;
      out[k] = stripSecrets(v, seen);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Global response filter: deep-removes secret-bearing fields from every JSON
 * body. Defence in depth — services should also avoid selecting them.
 */
export function sanitizeResponse(req: Request, res: Response, next: NextFunction) {
  // The auth domain returns session tokens by design.
  if (req.path.startsWith("/auth/")) return next();
  const json = res.json.bind(res);
  res.json = (body: unknown) => json(stripSecrets(body));
  next();
}
