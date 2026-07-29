import { getDb } from "../../config/db";
import { HttpError } from "../../utils/httpError";
import { userRepo } from "../../repositories/user.repository";
import { sessionRepo } from "../../repositories/session.repository";
import { hashPassword, verifyPassword } from "./password.service";
import {
  auditRepo,
  deviceRepo,
  loginAttemptRepo,
  type AuditCategory,
} from "../../repositories/iam.repository";

export interface RequestContext {
  userAgent?: string | null;
  ip?: string | null;
  actorId?: string | null;
}

/* ─────────────────────────── change password ─────────────────────────────── */

/**
 * Authenticated password change. Requires the current password, revokes every
 * other session, and keeps the caller's current session alive (the caller
 * re-authenticates transparently via refresh rotation).
 */
export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
  ctx: RequestContext,
): Promise<void> {
  const user = await userRepo.findById(userId);
  if (!user) throw HttpError.notFound("User not found");

  if (user.password_hash) {
    const result = await verifyPassword(user.password_hash, input.currentPassword);
    if (!result.valid) {
      await auditRepo.write({
        actorId: userId,
        targetUserId: userId,
        action: "password.change_failed",
        category: "security",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      throw HttpError.unauthorized("Current password is incorrect");
    }
  }
  // A null hash means the account is in the post-migration "must set password"
  // state — no current password to check.

  if (input.currentPassword === input.newPassword) {
    throw HttpError.badRequest("New password must be different from the current one");
  }

  const hash = await hashPassword(input.newPassword);
  await userRepo.updatePassword(userId, hash, "argon2id");
  await sessionRepo.revokeFamily(userId, "password_change");

  await auditRepo.write({
    actorId: userId,
    targetUserId: userId,
    action: "password.changed",
    category: "security",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

/* ───────────────────────────── sessions ──────────────────────────────────── */

export interface SessionView {
  id: string;
  device: string;
  userAgent: string | null;
  ip: string | null;
  issuedAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  current: boolean;
}

export async function listSessions(
  userId: string,
  currentSessionId?: string | null,
): Promise<SessionView[]> {
  const rows = await getDb()("refresh_sessions as s")
    .leftJoin("user_devices as d", "d.id", "s.device_id")
    .where("s.user_id", userId)
    .whereNull("s.revoked_at")
    .where("s.expires_at", ">", new Date())
    .orderBy("s.issued_at", "desc")
    .select(
      "s.id",
      "s.user_agent",
      "s.ip",
      "s.issued_at",
      "s.last_used_at",
      "s.expires_at",
      "d.label as device_label",
    );

  return rows.map((r: any) => ({
    id: r.id,
    device: r.device_label ?? "Unknown device",
    userAgent: r.user_agent,
    ip: r.ip,
    issuedAt: r.issued_at,
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
    current: currentSessionId ? r.id === currentSessionId : false,
  }));
}

export async function revokeSession(
  userId: string,
  sessionId: string,
  ctx: RequestContext,
): Promise<void> {
  const session = await sessionRepo.findById(sessionId);
  if (!session || session.user_id !== userId) throw HttpError.notFound("Session not found");
  await sessionRepo.revoke(sessionId, "revoked_by_user");
  await auditRepo.write({
    actorId: ctx.actorId ?? userId,
    targetUserId: userId,
    action: "session.revoked",
    category: "security",
    metadata: { sessionId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export async function revokeAllSessions(
  userId: string,
  ctx: RequestContext,
  reason = "revoked_all",
): Promise<void> {
  await sessionRepo.revokeFamily(userId, reason);
  await auditRepo.write({
    actorId: ctx.actorId ?? userId,
    targetUserId: userId,
    action: "session.revoked_all",
    category: "security",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

/* ────────────────────────── history & devices ────────────────────────────── */

export async function loginHistory(userId: string, limit = 50) {
  const rows = await loginAttemptRepo.history(userId, limit);
  return rows.map((r) => ({
    id: r.id,
    success: r.success,
    reason: r.reason,
    ip: r.ip,
    userAgent: r.user_agent,
    at: r.attempted_at,
  }));
}

export async function listDevices(userId: string) {
  const rows = await deviceRepo.list(userId);
  return rows.map((d) => ({
    id: d.id,
    label: d.label,
    userAgent: d.user_agent,
    lastIp: d.last_ip,
    trusted: d.trusted,
    firstSeenAt: d.first_seen_at,
    lastSeenAt: d.last_seen_at,
  }));
}

export async function removeDevice(userId: string, deviceId: string, ctx: RequestContext) {
  await getDb()("refresh_sessions")
    .where({ user_id: userId, device_id: deviceId })
    .whereNull("revoked_at")
    .update({ revoked_at: new Date(), revoked_reason: "device_removed" });
  await deviceRepo.remove(userId, deviceId);
  await auditRepo.write({
    actorId: ctx.actorId ?? userId,
    targetUserId: userId,
    action: "device.removed",
    category: "security",
    metadata: { deviceId },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

/* ─────────────────────────────── audit ───────────────────────────────────── */

export async function listAuditLogs(opts: {
  limit?: number;
  offset?: number;
  category?: AuditCategory;
  action?: string;
  userId?: string;
}) {
  const rows = await auditRepo.list(opts);
  return rows.map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    targetUserId: r.target_user_id,
    action: r.action,
    category: r.category,
    metadata: r.metadata,
    ip: r.ip,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  }));
}

/* ───────────────────── admin user management (IAM) ───────────────────────── */

export async function adminListUsers(opts: { search?: string; limit?: number; offset?: number }) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const q = getDb()("app_users as u")
    .leftJoin("profiles as p", "p.id", "u.id")
    .select(
      "u.id",
      "u.email",
      "u.is_active",
      "u.email_verified_at",
      "u.last_login_at",
      "u.locked_until",
      "u.failed_login_count",
      "u.password_hash",
      "u.created_at",
      "p.full_name",
      "p.avatar_url",
    )
    .orderBy("u.created_at", "desc")
    .limit(limit)
    .offset(opts.offset ?? 0);

  if (opts.search) {
    const term = `%${opts.search.toLowerCase()}%`;
    q.where((b) =>
      b.whereRaw("lower(u.email) like ?", [term]).orWhereRaw("lower(coalesce(p.full_name,'')) like ?", [term]),
    );
  }

  const rows = await q;
  const ids = rows.map((r: any) => r.id);
  const roleRows = ids.length
    ? await getDb()("user_roles").whereIn("user_id", ids).select("user_id", "role")
    : [];

  return rows.map((r: any) => ({
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    avatarUrl: r.avatar_url,
    isActive: r.is_active,
    emailVerified: !!r.email_verified_at,
    lastLoginAt: r.last_login_at,
    lockedUntil: r.locked_until,
    failedLoginCount: r.failed_login_count,
    // Never expose the hash — only whether a password has been set.
    passwordSet: !!r.password_hash,
    createdAt: r.created_at,
    roles: roleRows.filter((x: any) => x.user_id === r.id).map((x: any) => x.role),
  }));
}

export async function adminSetActive(
  targetUserId: string,
  isActive: boolean,
  ctx: RequestContext,
): Promise<void> {
  await getDb()("app_users").where({ id: targetUserId }).update({ is_active: isActive });
  if (!isActive) await sessionRepo.revokeFamily(targetUserId, "account_disabled");
  await auditRepo.write({
    actorId: ctx.actorId,
    targetUserId,
    action: isActive ? "user.activated" : "user.deactivated",
    category: "admin",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export async function adminUnlock(targetUserId: string, ctx: RequestContext): Promise<void> {
  await getDb()("app_users")
    .where({ id: targetUserId })
    .update({ locked_until: null, failed_login_count: 0 });
  await auditRepo.write({
    actorId: ctx.actorId,
    targetUserId,
    action: "user.unlocked",
    category: "admin",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

/**
 * Clear the stored hash and kill sessions — the user must go through the
 * existing forgot-password flow to set a new one. This is also the exact state
 * every migrated account starts in after the GoTrue cutover.
 */
export async function adminForcePasswordReset(
  targetUserId: string,
  ctx: RequestContext,
): Promise<void> {
  await getDb()("app_users")
    .where({ id: targetUserId })
    .update({ password_hash: null, updated_at: new Date() });
  await sessionRepo.revokeFamily(targetUserId, "admin_force_reset");
  await auditRepo.write({
    actorId: ctx.actorId,
    targetUserId,
    action: "user.password_reset_forced",
    category: "admin",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export async function adminGrantRole(
  targetUserId: string,
  role: string,
  ctx: RequestContext,
): Promise<void> {
  await getDb()("user_roles")
    .insert({ user_id: targetUserId, role })
    .onConflict(["user_id", "role"])
    .ignore();
  await auditRepo.write({
    actorId: ctx.actorId,
    targetUserId,
    action: "role.granted",
    category: "admin",
    metadata: { role },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export async function adminRevokeRole(
  targetUserId: string,
  role: string,
  ctx: RequestContext,
): Promise<void> {
  await getDb()("user_roles").where({ user_id: targetUserId, role }).delete();
  await auditRepo.write({
    actorId: ctx.actorId,
    targetUserId,
    action: "role.revoked",
    category: "admin",
    metadata: { role },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export async function adminListUserSessions(targetUserId: string) {
  return listSessions(targetUserId, null);
}
