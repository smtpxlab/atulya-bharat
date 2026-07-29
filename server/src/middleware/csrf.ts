import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env, isProd } from "../config/env";
import { HttpError } from "../utils/httpError";
import { CSRF_COOKIE } from "../utils/authCookies";

/**
 * Double-submit CSRF protection.
 *
 * Required because the refresh token travels in a cookie. The cookie is
 * readable by JS (NOT HttpOnly) on purpose — the client copies its value into
 * the `X-CSRF-Token` header. An attacker on another origin can force the
 * browser to send the cookie but cannot read it to set the header.
 *
 * Bearer-authenticated requests (mobile clients, no cookie) are exempt: there
 * is no ambient credential for a cross-site request to abuse.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_HEADER = "x-csrf-token";

export function issueCsrfToken(res: Response): string {
  const token = crypto.randomBytes(32).toString("base64url");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProd || env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  });
  return token;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  // No cookie credential in play → nothing to forge.
  const hasCookieCredential = Boolean(req.cookies?.abr_rt);
  if (!hasCookieCredential) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    cookieToken.length === 0 ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return next(HttpError.forbidden("Invalid or missing CSRF token"));
  }
  return next();
}
