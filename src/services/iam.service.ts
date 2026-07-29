// Client for the custom auth/IAM API exposed by the Express backend (Backend B).
// These endpoints only exist when VITE_BACKEND_ENABLED=true.
import { request } from "@/integrations/backend/http";
import { BACKEND_ENABLED } from "@/integrations/backend/config";

export type AppRole = "user" | "admin" | "super_admin" | "club_owner" | "content_manager";

export interface IamUser {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  lockedUntil: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: AppRole[];
}

export interface IamSession {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  current?: boolean;
  deviceId?: string | null;
}

export interface IamDevice {
  id: string;
  name: string | null;
  userAgent: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  ip?: string | null;
}

export interface LoginAttempt {
  id: string;
  userId: string | null;
  email: string | null;
  success: boolean;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  at: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  userId: string | null;
  category: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export class BackendDisabledError extends Error {
  constructor() {
    super("The custom authentication backend is not enabled for this environment.");
    this.name = "BackendDisabledError";
  }
}

function guard() {
  if (!BACKEND_ENABLED) throw new BackendDisabledError();
}

/* ── current user (self-service security) ─────────────────────────────── */

export const securityService = {
  listSessions(): Promise<IamSession[]> {
    guard();
    return request<IamSession[]>({ path: "/auth/sessions" });
  },
  revokeSession(id: string) {
    guard();
    return request({ method: "DELETE", path: `/auth/sessions/${id}` });
  },
  revokeAllSessions() {
    guard();
    return request({ method: "DELETE", path: "/auth/sessions" });
  },
  listDevices(): Promise<IamDevice[]> {
    guard();
    return request<IamDevice[]>({ path: "/auth/devices" });
  },
  removeDevice(id: string) {
    guard();
    return request({ method: "DELETE", path: `/auth/devices/${id}` });
  },
  loginHistory(limit = 50): Promise<LoginAttempt[]> {
    guard();
    return request<LoginAttempt[]>({ path: "/auth/login-history", query: { limit } });
  },
  changePassword(currentPassword: string, newPassword: string) {
    guard();
    return request({
      method: "POST",
      path: "/auth/change-password",
      body: { currentPassword, newPassword },
    });
  },
};

/* ── admin IAM ────────────────────────────────────────────────────────── */

export const iamService = {
  listUsers(params: { search?: string; limit?: number; offset?: number }): Promise<IamUser[]> {
    guard();
    return request<IamUser[]>({ path: "/admin/iam/users", query: params });
  },
  setActive(id: string, isActive: boolean) {
    guard();
    return request({ method: "PATCH", path: `/admin/iam/users/${id}/active`, body: { isActive } });
  },
  unlock(id: string) {
    guard();
    return request({ method: "POST", path: `/admin/iam/users/${id}/unlock` });
  },
  forcePasswordReset(id: string) {
    guard();
    return request({ method: "POST", path: `/admin/iam/users/${id}/force-password-reset` });
  },
  grantRole(id: string, role: AppRole) {
    guard();
    return request({ method: "POST", path: `/admin/iam/users/${id}/roles`, body: { role } });
  },
  revokeRole(id: string, role: AppRole) {
    guard();
    return request({ method: "DELETE", path: `/admin/iam/users/${id}/roles`, body: { role } });
  },
  userSessions(id: string): Promise<IamSession[]> {
    guard();
    return request<IamSession[]>({ path: `/admin/iam/users/${id}/sessions` });
  },
  revokeUserSessions(id: string) {
    guard();
    return request({ method: "DELETE", path: `/admin/iam/users/${id}/sessions` });
  },
  auditLogs(params: { limit?: number; offset?: number; category?: string; action?: string; userId?: string }): Promise<AuditLog[]> {
    guard();
    return request<AuditLog[]>({ path: "/admin/iam/audit-logs", query: params });
  },
  loginAttempts(params: { limit?: number; offset?: number; success?: boolean }): Promise<LoginAttempt[]> {
    guard();
    return request<LoginAttempt[]>({ path: "/admin/iam/login-attempts", query: params });
  },
};
