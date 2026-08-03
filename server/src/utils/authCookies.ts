import type { Response, Request } from "express";
import { env, isProd } from "../config/env";

/**
 * Refresh-token transport.
 *
 * The access token is returned in the JSON body and held in memory by the
 * client (never localStorage). The refresh token lives ONLY in an HTTP-only
 * cookie so XSS cannot exfiltrate it.
 *
 * Frontend and API are on different origins (Lovable-hosted app ⇄ Railway API),
 * so the cookie must be SameSite=None; Secure. That in turn requires CSRF
 * protection — see middleware/csrf.ts.
 */
export const REFRESH_COOKIE = "abr_rt";
export const CSRF_COOKIE = "abr_csrf";

/** "Remember me" off → session cookie; on → full refresh TTL. */
export function setRefreshCookie(res: Response, token: string, opts: { remember?: boolean; maxAgeMs: number }) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd || env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
    signed: false,
    ...(opts.remember === false ? {} : { maxAge: opts.maxAgeMs }),
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProd || env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  });
}

export function readRefreshToken(req: Request): string | undefined {
  // Native/mobile clients have no cookie jar: the body token is canonical for
  // them. Browsers keep using the HTTP-only cookie.
  if (isTokenTransportClient(req)) {
    return (req.body?.refreshToken as string | undefined) ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
  }
  return (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? req.body?.refreshToken;
}

/**
 * True when the client asked for "tokens in the JSON body" transport via
 * `X-Client-Type: mobile` (or the legacy `native` value). Such clients get no
 * refresh cookie and no CSRF cookie, and send the refresh token in the body.
 */
export const TOKEN_TRANSPORT_CLIENTS = new Set(["mobile", "native"]);

export function isTokenTransportClient(req: Request): boolean {
  const raw = req.headers["x-client-type"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && TOKEN_TRANSPORT_CLIENTS.has(value.trim().toLowerCase());
}

