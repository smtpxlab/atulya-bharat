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
  // Cookie is canonical. Body fallback keeps native mobile clients (which have
  // no cookie jar) working against the same endpoint.
  return (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? req.body?.refreshToken;
}
