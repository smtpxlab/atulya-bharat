import crypto from "node:crypto";
import { getDb } from "../config/db";

/* ─────────────────────────── login attempts ──────────────────────────────── */

export interface LoginAttemptRow {
  id: string;
  user_id: string | null;
  email: string;
  success: boolean;
  reason: string | null;
  ip: string | null;
  user_agent: string | null;
  attempted_at: Date;
}

export const loginAttemptRepo = {
  async record(row: {
    user_id?: string | null;
    email: string;
    success: boolean;
    reason?: string | null;
    ip?: string | null;
    user_agent?: string | null;
  }): Promise<void> {
    await getDb()("login_attempts").insert({
      user_id: row.user_id ?? null,
      email: row.email,
      success: row.success,
      reason: row.reason ?? null,
      ip: row.ip ?? null,
      user_agent: row.user_agent ?? null,
    });
  },

  /** Failed attempts for an email inside a rolling window (brute-force gate). */
  async recentFailures(email: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const [row] = await getDb()("login_attempts")
      .whereRaw("lower(email) = lower(?)", [email])
      .andWhere("success", false)
      .andWhere("attempted_at", ">=", since)
      .count<{ count: string }[]>("* as count");
    return Number(row?.count ?? 0);
  },

  async history(userId: string, limit = 50): Promise<LoginAttemptRow[]> {
    return getDb()<LoginAttemptRow>("login_attempts")
      .where({ user_id: userId })
      .orderBy("attempted_at", "desc")
      .limit(limit);
  },

  async list(opts: { limit?: number; offset?: number; success?: boolean } = {}) {
    const q = getDb()<LoginAttemptRow>("login_attempts")
      .orderBy("attempted_at", "desc")
      .limit(opts.limit ?? 100)
      .offset(opts.offset ?? 0);
    if (typeof opts.success === "boolean") q.where("success", opts.success);
    return q;
  },
};

/* ───────────────────────────── user devices ──────────────────────────────── */

export interface UserDeviceRow {
  id: string;
  user_id: string;
  fingerprint: string;
  label: string | null;
  user_agent: string | null;
  last_ip: string | null;
  trusted: boolean;
  first_seen_at: Date;
  last_seen_at: Date;
}

/** Human-friendly label from a UA string — no external dependency. */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox"
    : "Browser";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iOS/.test(ua) ? "iOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "Unknown OS";
  return `${browser} on ${os}`;
}

export function fingerprintOf(userAgent: string | null | undefined): string {
  return crypto
    .createHash("sha256")
    .update(userAgent ?? "unknown")
    .digest("hex");
}

export const deviceRepo = {
  /** Upsert the device row for this user + user-agent, returning its id. */
  async touch(
    userId: string,
    userAgent: string | null,
    ip: string | null,
  ): Promise<UserDeviceRow> {
    const fingerprint = fingerprintOf(userAgent);
    const db = getDb();
    const [row] = await db<UserDeviceRow>("user_devices")
      .insert({
        user_id: userId,
        fingerprint,
        label: describeUserAgent(userAgent),
        user_agent: userAgent,
        last_ip: ip,
      })
      .onConflict(["user_id", "fingerprint"])
      .merge({ last_seen_at: new Date(), last_ip: ip, user_agent: userAgent })
      .returning("*");
    return row;
  },

  async list(userId: string): Promise<UserDeviceRow[]> {
    return getDb()<UserDeviceRow>("user_devices")
      .where({ user_id: userId })
      .orderBy("last_seen_at", "desc");
  },

  async remove(userId: string, deviceId: string): Promise<void> {
    await getDb()("user_devices").where({ id: deviceId, user_id: userId }).delete();
  },
};

/* ─────────────────────────────── audit log ───────────────────────────────── */

export type AuditCategory = "auth" | "security" | "admin";

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  action: string;
  category: AuditCategory;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: Date;
}

export const auditRepo = {
  async write(entry: {
    actorId?: string | null;
    targetUserId?: string | null;
    action: string;
    category?: AuditCategory;
    metadata?: Record<string, unknown>;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await getDb()("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      target_user_id: entry.targetUserId ?? null,
      action: entry.action,
      category: entry.category ?? "auth",
      metadata: JSON.stringify(entry.metadata ?? {}),
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
    });
  },

  async list(opts: {
    limit?: number;
    offset?: number;
    category?: AuditCategory;
    action?: string;
    userId?: string;
  } = {}): Promise<AuditLogRow[]> {
    const q = getDb()<AuditLogRow>("audit_logs")
      .orderBy("created_at", "desc")
      .limit(Math.min(opts.limit ?? 100, 500))
      .offset(opts.offset ?? 0);
    if (opts.category) q.where("category", opts.category);
    if (opts.action) q.where("action", opts.action);
    if (opts.userId) {
      q.where((b) => b.where("actor_id", opts.userId!).orWhere("target_user_id", opts.userId!));
    }
    return q;
  },
};
