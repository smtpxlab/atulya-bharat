import type { Request, Response } from "express";
import * as authService from "../services/auth/auth.service";
import * as iam from "../services/auth/iam.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import {
  clearRefreshCookie,
  isTokenTransportClient,
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
 * Web clients: sets the HTTP-only refresh cookie + CSRF cookie and keeps the
 * refresh token out of the JSON body.
 *
 * Mobile/native clients (`X-Client-Type: mobile` or `native`): no cookies at
 * all — the refresh token is returned in the JSON body and must be stored in
 * the platform keychain by the client.
 */
function respondWithSession(req: Request, res: Response, result: authService.AuthResult, status = 200) {
  const tokenTransport = isTokenTransportClient(req);

  const body: Record<string, unknown> = {
    user: result.user,
    accessToken: result.accessToken,
    accessTokenExpiresIn: result.accessTokenExpiresIn,
    sessionId: result.sessionId,
  };

  if (tokenTransport) {
    body.refreshToken = result.refreshToken;
    body.refreshTokenExpiresIn = Math.floor(result.refreshTokenMaxAgeMs / 1000);
  } else {
    setRefreshCookie(res, result.refreshToken, {
      remember: result.remember,
      maxAgeMs: result.refreshTokenMaxAgeMs,
    });
    body.csrfToken = issueCsrfToken(res);
  }

  res.status(status).json(body);
}

/** Cookie clearing is a no-op for clients that never received cookies. */
function clearSessionCookies(req: Request, res: Response) {
  if (!isTokenTransportClient(req)) clearRefreshCookie(res);
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
    if (!token) {
      // Mobile clients must supply the token in the body — say so explicitly
      // instead of returning an opaque 401.
      if (isTokenTransportClient(req)) {
        throw HttpError.badRequest("refreshToken is required in the request body for mobile clients");
      }
      throw HttpError.unauthorized("Missing refresh token");
    }
    const result = await authService.refresh(token, ctx(req));
    respondWithSession(req, res, result);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout({
      refreshToken: readRefreshToken(req),
      userId: req.user?.sub,
      allDevices: req.body?.allDevices === true,
    });
    clearSessionCookies(req, res);
    res.status(204).send();
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email, req.ip ?? null);
    // Always 202 to avoid leaking account existence.
    res.status(202).json({ ok: true });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.token, req.body.password);
    clearSessionCookies(req, res);
    res.json({ ok: true });
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await iam.changePassword(req.user!.sub, req.body, ctx(req));
    clearSessionCookies(req, res);
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
    clearSessionCookies(req, res);
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
