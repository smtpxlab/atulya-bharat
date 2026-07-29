import crypto from "node:crypto";
import { getDb } from "../../config/db";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { HttpError } from "../../utils/httpError";
import { userRepo } from "../../repositories/user.repository";
import { sessionRepo } from "../../repositories/session.repository";
import {
  verificationRepo,
  passwordResetRepo,
} from "../../repositories/verification.repository";
import { hashPassword, verifyPassword } from "./password.service";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  newSessionId,
  type TokenPayload,
} from "./token.service";
import { sendMail } from "../email/mailer.service";
import { auditRepo, deviceRepo, loginAttemptRepo } from "../../repositories/iam.repository";

const REFRESH_TTL_MS = parseDurationMs(env.JWT_REFRESH_TTL);
const REMEMBER_TTL_MS = env.REFRESH_REMEMBER_DAYS * 86_400_000;
const SESSION_TTL_MS = env.REFRESH_SESSION_DAYS * 86_400_000;
const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const RESET_TTL_MS = 1000 * 60 * 30; // 30m


function parseDurationMs(v: string): number {
  // Accepts "30d", "15m", "1h", or bare seconds. Falls back to 30 days.
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(v.trim());
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2]) {
    case "ms":
      return n;
    case "s":
      return n * 1000;
    case "m":
      return n * 60_000;
    case "h":
      return n * 3_600_000;
    case undefined:
    case "d":
    default:
      return n * 86_400_000;
  }
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export interface AuthContext {
  userAgent?: string | null;
  ip?: string | null;
  /** "Remember me" — long-lived refresh cookie vs. browser-session cookie. */
  remember?: boolean;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    roles: string[];
  };
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
  /** Current session id — used to flag "this device" in the sessions list. */
  sessionId: string;
  /** Cookie max-age for the refresh token, in ms. */
  refreshTokenMaxAgeMs: number;
  remember: boolean;
}

function refreshTtlFor(remember: boolean | undefined): number {
  const ttl = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  // Never outlive the signed JWT itself.
  return Math.min(ttl, REFRESH_TTL_MS);
}

async function issueTokens(
  userId: string,
  email: string,
  roles: string[],
  ctx: AuthContext,
  parentId: string | null = null,
  deviceId: string | null = null,
): Promise<{ accessToken: string; refreshToken: string; sid: string; ttlMs: number }> {
  const sid = newSessionId();
  const payload: TokenPayload = { sub: userId, email, roles, sid };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ ...payload, sid });
  const ttlMs = refreshTtlFor(ctx.remember);
  const session = await sessionRepo.create({
    user_id: userId,
    token_hash: sha256(refreshToken),
    parent_id: parentId,
    user_agent: ctx.userAgent ?? null,
    ip: ctx.ip ?? null,
    expires_at: new Date(Date.now() + ttlMs),
  });
  if (deviceId) {
    await getDb()("refresh_sessions")
      .where({ id: session.id })
      .update({ device_id: deviceId, last_used_at: new Date() });
  }
  return { accessToken, refreshToken, sid: session.id, ttlMs };
}

function buildResult(
  user: { id: string; email: string; emailVerified: boolean; roles: string[] },
  accessToken: string,
  refreshToken: string,
  meta: { sessionId: string; ttlMs: number; remember: boolean },
): AuthResult {
  return {
    user,
    accessToken,
    refreshToken,
    accessTokenExpiresIn: env.JWT_ACCESS_TTL,
    refreshTokenExpiresIn: env.JWT_REFRESH_TTL,
    sessionId: meta.sessionId,
    refreshTokenMaxAgeMs: meta.ttlMs,
    remember: meta.remember,
  };
}


// ─── Register ────────────────────────────────────────────────────────────────
export async function register(
  input: { email: string; password: string; fullName?: string },
  ctx: AuthContext,
): Promise<AuthResult> {
  const existing = await userRepo.findByEmail(input.email);
  if (existing) throw HttpError.conflict("Email already registered");

  const db = getDb();
  const passwordHash = await hashPassword(input.password);

  const user = await db.transaction(async (trx) => {
    const id = crypto.randomUUID();
    // profiles.id is the identity anchor for FKs — create it first, then app_users.
    await trx("profiles")
      .insert({
        id,
        email: input.email,
        full_name: input.fullName ?? null,
      })
      .onConflict("id")
      .ignore();
    const [row] = await trx("app_users")
      .insert({
        id,
        email: input.email,
        password_hash: passwordHash,
        password_algo: "argon2id",
      })
      .returning(["id", "email", "email_verified_at"]);
    await trx("user_roles").insert({ user_id: id, role: "user" }).onConflict().ignore();
    return row as { id: string; email: string; email_verified_at: Date | null };
  });

  // Fire-and-forget verification email
  void issueEmailVerification(user.id, user.email).catch((err) =>
    logger.error({ err }, "email verification dispatch failed"),
  );

  const roles = ["user"];
  const device = await deviceRepo.touch(user.id, ctx.userAgent ?? null, ctx.ip ?? null);
  const { accessToken, refreshToken, sid, ttlMs } = await issueTokens(
    user.id,
    user.email,
    roles,
    ctx,
    null,
    device.id,
  );
  await auditRepo.write({
    actorId: user.id,
    targetUserId: user.id,
    action: "user.registered",
    category: "auth",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return buildResult(
    { id: user.id, email: user.email, emailVerified: false, roles },
    accessToken,
    refreshToken,
    { sessionId: sid, ttlMs, remember: !!ctx.remember },
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────
export async function login(
  input: { email: string; password: string; remember?: boolean },
  ctx: AuthContext,
): Promise<AuthResult> {
  const authCtx: AuthContext = { ...ctx, remember: input.remember ?? ctx.remember };

  /** Record the attempt, then hand back the error for the caller to throw. */
  const fail = async <E>(reason: string, userId: string | null, error: E): Promise<E> => {
    await loginAttemptRepo.record({
      user_id: userId,
      email: input.email,
      success: false,
      reason,
      ip: ctx.ip,
      user_agent: ctx.userAgent,
    });
    return error;
  };

  const user = await userRepo.findByEmail(input.email);
  if (!user || !user.password_hash) {
    // Constant-time-ish: still hash a dummy to avoid trivial timing leak
    await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA", input.password).catch(
      () => undefined,
    );
    // A user row with a null hash is a migrated account that has not set a
    // password yet — tell it apart so the UI can nudge to "reset password".
    if (user && !user.password_hash) {
      throw await fail(
        "password_not_set",
        user.id,
        HttpError.unauthorized("Please set a new password using 'Forgot password'"),
      );
    }
    throw await fail("unknown_email", null, HttpError.unauthorized("Invalid email or password"));
  }
  if (!user.is_active) {
    throw await fail("disabled", user.id, HttpError.forbidden("Account disabled"));
  }
  if (user.locked_until && user.locked_until > new Date()) {
    throw await fail(
      "locked",
      user.id,
      HttpError.tooMany("Account temporarily locked. Try again later."),
    );
  }

  const result = await verifyPassword(user.password_hash, input.password);
  if (!result.valid) {
    await userRepo.recordLoginFailure(user.id, env.LOGIN_LOCK_THRESHOLD, env.LOGIN_LOCK_MINUTES);
    throw await fail("invalid_password", user.id, HttpError.unauthorized("Invalid email or password"));
  }

  // Transparent Argon2 upgrade path (legacy bcrypt → Argon2id)
  if (result.needsRehash) {
    try {
      const newHash = await hashPassword(input.password);
      await userRepo.updatePassword(user.id, newHash, "argon2id");
      logger.info({ userId: user.id }, "password hash upgraded to argon2id");
    } catch (err) {
      logger.warn({ err, userId: user.id }, "password rehash failed (non-fatal)");
    }
  }

  await userRepo.recordLoginSuccess(user.id);
  const roles = await userRepo.getRoles(user.id);
  const device = await deviceRepo.touch(user.id, ctx.userAgent ?? null, ctx.ip ?? null);
  const { accessToken, refreshToken, sid, ttlMs } = await issueTokens(
    user.id,
    user.email,
    roles,
    authCtx,
    null,
    device.id,
  );
  await loginAttemptRepo.record({
    user_id: user.id,
    email: user.email,
    success: true,
    ip: ctx.ip,
    user_agent: ctx.userAgent,
  });
  await auditRepo.write({
    actorId: user.id,
    targetUserId: user.id,
    action: "login",
    category: "auth",
    metadata: { deviceId: device.id, remember: !!authCtx.remember },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return buildResult(
    {
      id: user.id,
      email: user.email,
      emailVerified: !!user.email_verified_at,
      roles,
    },
    accessToken,
    refreshToken,
    { sessionId: sid, ttlMs, remember: !!authCtx.remember },
  );
}

// ─── Refresh (rotating) ──────────────────────────────────────────────────────
export async function refresh(refreshToken: string, ctx: AuthContext): Promise<AuthResult> {
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw HttpError.unauthorized("Invalid refresh token");
  }
  const hash = sha256(refreshToken);
  const session = await sessionRepo.findByTokenHash(hash);
  if (!session) {
    // Token verified cryptographically but not in DB → replay of an old family
    await sessionRepo.revokeFamily(payload.sub, "reuse_detected");
    await auditRepo.write({
      actorId: payload.sub,
      targetUserId: payload.sub,
      action: "refresh.reuse_detected",
      category: "security",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw HttpError.unauthorized("Refresh token reuse detected");
  }
  if (session.revoked_at) {
    // A revoked token being replayed → nuke every active session in the family.
    await sessionRepo.revokeFamily(session.user_id, "reuse_detected");
    await auditRepo.write({
      actorId: session.user_id,
      targetUserId: session.user_id,
      action: "refresh.reuse_detected",
      category: "security",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw HttpError.unauthorized("Refresh token has been revoked");
  }
  if (session.expires_at < new Date()) {
    await sessionRepo.revoke(session.id, "expired");
    throw HttpError.unauthorized("Refresh token expired");
  }

  // Preserve the original "remember me" decision across rotations: a long-lived
  // session keeps its long TTL, a browser-session one stays short.
  const originalLifetimeMs = session.expires_at.getTime() - session.issued_at.getTime();
  const remember = originalLifetimeMs > SESSION_TTL_MS;

  // Rotate: revoke this token, issue a new one with parent_id linkage.
  await sessionRepo.revoke(session.id, "rotated");
  const user = await userRepo.findById(session.user_id);
  if (!user || !user.is_active) throw HttpError.unauthorized("Account unavailable");
  const roles = await userRepo.getRoles(user.id);
  const device = await deviceRepo.touch(user.id, ctx.userAgent ?? null, ctx.ip ?? null);
  const {
    accessToken,
    refreshToken: newRefresh,
    sid,
    ttlMs,
  } = await issueTokens(user.id, user.email, roles, { ...ctx, remember }, session.id, device.id);
  return buildResult(
    {
      id: user.id,
      email: user.email,
      emailVerified: !!user.email_verified_at,
      roles,
    },
    accessToken,
    newRefresh,
    { sessionId: sid, ttlMs, remember },
  );
}


// ─── Logout ──────────────────────────────────────────────────────────────────
export async function logout(opts: {
  refreshToken?: string;
  userId?: string;
  allDevices?: boolean;
}): Promise<void> {
  let userId = opts.userId ?? null;

  if (opts.allDevices && userId) {
    await sessionRepo.revokeFamily(userId, "logout");
  } else if (opts.refreshToken) {
    const session = await sessionRepo.findByTokenHash(sha256(opts.refreshToken));
    if (session) {
      userId = userId ?? session.user_id;
      if (!session.revoked_at) await sessionRepo.revoke(session.id, "logout");
    }
  }

  if (userId) {
    await auditRepo.write({
      actorId: userId,
      targetUserId: userId,
      action: opts.allDevices ? "logout.all_devices" : "logout",
      category: "auth",
    });
  }
}

// ─── Email verification ──────────────────────────────────────────────────────
export async function issueEmailVerification(userId: string, email: string): Promise<void> {
  const raw = randomToken();
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);
  await verificationRepo.create(userId, sha256(raw), expiresAt);
  const link = `${env.PUBLIC_APP_URL}/verify-email?token=${raw}`;
  try {
    await sendMail({
      to: email,
      subject: "Verify your email",
      text: `Confirm your email: ${link}\nLink expires in 24 hours.`,
      html: `<p>Confirm your email by clicking <a href="${link}">here</a>. Link expires in 24 hours.</p>`,
    });
  } catch (err) {
    logger.warn({ err }, "verification email not sent (SMTP not configured?)");
  }
}

export async function verifyEmail(token: string): Promise<void> {
  const row = await verificationRepo.findByTokenHash(sha256(token));
  if (!row || row.consumed_at || row.expires_at < new Date())
    throw HttpError.badRequest("Invalid or expired verification token");
  await verificationRepo.consume(row.id);
  await userRepo.markEmailVerified(row.user_id);
}

export async function resendVerification(email: string): Promise<void> {
  const user = await userRepo.findByEmail(email);
  if (!user || user.email_verified_at) return; // silent
  await issueEmailVerification(user.id, user.email);
}

// ─── Password reset ──────────────────────────────────────────────────────────
export async function forgotPassword(email: string, ip: string | null): Promise<void> {
  const user = await userRepo.findByEmail(email);
  if (!user) return; // do not leak account existence
  const raw = randomToken();
  await passwordResetRepo.create(
    user.id,
    sha256(raw),
    new Date(Date.now() + RESET_TTL_MS),
    ip,
  );
  const link = `${env.PUBLIC_APP_URL}/reset-password?token=${raw}`;
  try {
    await sendMail({
      to: user.email,
      subject: "Reset your password",
      text: `Reset your password: ${link}\nLink expires in 30 minutes.`,
      html: `<p>Reset your password <a href="${link}">here</a>. Link expires in 30 minutes.</p>`,
    });
  } catch (err) {
    logger.warn({ err }, "reset email not sent");
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const row = await passwordResetRepo.findByTokenHash(sha256(token));
  if (!row || row.consumed_at || row.expires_at < new Date())
    throw HttpError.badRequest("Invalid or expired reset token");
  const hash = await hashPassword(newPassword);
  await passwordResetRepo.consume(row.id);
  await userRepo.updatePassword(row.user_id, hash, "argon2id");
  // Invalidate every active session as a security precaution.
  await sessionRepo.revokeFamily(row.user_id, "password_reset");
}

// ─── Me ──────────────────────────────────────────────────────────────────────
export async function getMe(userId: string) {
  const user = await userRepo.findById(userId);
  if (!user) throw HttpError.notFound("User not found");
  const roles = await userRepo.getRoles(user.id);
  return {
    id: user.id,
    email: user.email,
    emailVerified: !!user.email_verified_at,
    roles,
    createdAt: user.created_at,
  };
}
