import type { Request, Response } from "express";
import * as authService from "../services/auth/auth.service";
import * as iam from "../services/auth/iam.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import {
  clearRefreshCookie,
  readRefreshToken,
  setRefreshCookie,
} from "../utils/authCookies";
import { issueCsrfToken } from "../middleware/csrf";

function ctx(req: Request) {
  return {
    userAgent: req.headers["user-agent"] ?? null,
    ip: req.ip ?? null,
    actorId: req.user?.sub ?? null,
  };
}

/**
 * Sets the HTTP-only refresh cookie + CSRF cookie and strips the refresh token
 * from the JSON body for browser clients. Native clients (no cookie jar) can
 * opt in to a body token with `X-Client-Type: native`.
 */
function respondWithSession(req: Request, res: Response, result: authService.AuthResult, status = 200) {
  setRefreshCookie(res, result.refreshToken, {
    remember: result.remember,
    maxAgeMs: result.refreshTokenMaxAgeMs,
  });
  const csrfToken = issueCsrfToken(res);

  const isNative = req.headers["x-client-type"] === "native";
  const body: Record<string, unknown> = {
    user: result.user,
    accessToken: result.accessToken,
    accessTokenExpiresIn: result.accessTokenExpiresIn,
    sessionId: result.sessionId,
    csrfToken,
  };
  if (isNative) body.refreshToken = result.refreshToken;

  res.status(status).json(body);
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body, ctx(req));
    respondWithSession(req, res, result, 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body, {
      ...ctx(req),
      remember: req.body.remember === true,
    });
    respondWithSession(req, res, result);
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token = readRefreshToken(req);
    if (!token) throw HttpError.unauthorized("Missing refresh token");
    const result = await authService.refresh(token, ctx(req));
    respondWithSession(req, res, result);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout({
      refreshToken: readRefreshToken(req),
      userId: req.user?.sub,
      allDevices: req.body?.allDevices === true,
    });
    clearRefreshCookie(res);
    res.status(204).send();
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email, req.ip ?? null);
    // Always 202 to avoid leaking account existence.
    res.status(202).json({ ok: true });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.token, req.body.password);
    clearRefreshCookie(res);
    res.json({ ok: true });
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await iam.changePassword(req.user!.sub, req.body, ctx(req));
    clearRefreshCookie(res);
    res.json({ ok: true, reauthRequired: true });
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    await authService.verifyEmail(req.body.token);
    res.json({ ok: true });
  }),

  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    await authService.resendVerification(req.body.email);
    res.status(202).json({ ok: true });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const me = await authService.getMe(req.user!.sub);
    res.json(me);
  }),

  /* ── sessions / devices / history ─────────────────────────────────────── */

  listSessions: asyncHandler(async (req: Request, res: Response) => {
    res.json(await iam.listSessions(req.user!.sub, req.user!.sid ?? null));
  }),

  revokeSession: asyncHandler(async (req: Request, res: Response) => {
    await iam.revokeSession(req.user!.sub, req.params.id, ctx(req));
    res.status(204).send();
  }),

  revokeAllSessions: asyncHandler(async (req: Request, res: Response) => {
    await iam.revokeAllSessions(req.user!.sub, ctx(req));
    clearRefreshCookie(res);
    res.status(204).send();
  }),

  listDevices: asyncHandler(async (req: Request, res: Response) => {
    res.json(await iam.listDevices(req.user!.sub));
  }),

  removeDevice: asyncHandler(async (req: Request, res: Response) => {
    await iam.removeDevice(req.user!.sub, req.params.id, ctx(req));
    res.status(204).send();
  }),

  loginHistory: asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    res.json(await iam.loginHistory(req.user!.sub, limit));
  }),
};
