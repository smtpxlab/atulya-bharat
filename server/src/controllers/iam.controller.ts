import type { Request, Response } from "express";
import * as iam from "../services/auth/iam.service";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { isAppRole, hasAnyRole } from "../middleware/requireRole";
import { loginAttemptRepo } from "../repositories/iam.repository";

function ctx(req: Request) {
  return {
    userAgent: req.headers["user-agent"] ?? null,
    ip: req.ip ?? null,
    actorId: req.user?.sub ?? null,
  };
}

/** Only super_admin may touch admin-level roles — prevents lateral escalation. */
function assertCanManageRole(req: Request, role: string) {
  if (!isAppRole(role)) throw HttpError.badRequest("Unknown role");
  const privileged = role === "admin" || role === "super_admin";
  if (privileged && !hasAnyRole(req.user?.roles, ["super_admin"])) {
    throw HttpError.forbidden("Only a super admin can grant or revoke admin roles");
  }
}

export const iamController = {
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const users = await iam.adminListUsers({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json(users);
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    if (req.params.id === req.user!.sub) {
      throw HttpError.badRequest("You cannot change your own account status");
    }
    await iam.adminSetActive(req.params.id, req.body.isActive === true, ctx(req));
    res.json({ ok: true });
  }),

  unlock: asyncHandler(async (req: Request, res: Response) => {
    await iam.adminUnlock(req.params.id, ctx(req));
    res.json({ ok: true });
  }),

  forcePasswordReset: asyncHandler(async (req: Request, res: Response) => {
    await iam.adminForcePasswordReset(req.params.id, ctx(req));
    res.json({ ok: true });
  }),

  grantRole: asyncHandler(async (req: Request, res: Response) => {
    assertCanManageRole(req, req.body.role);
    await iam.adminGrantRole(req.params.id, req.body.role, ctx(req));
    res.json({ ok: true });
  }),

  revokeRole: asyncHandler(async (req: Request, res: Response) => {
    assertCanManageRole(req, req.body.role);
    if (req.params.id === req.user!.sub && req.body.role === "super_admin") {
      throw HttpError.badRequest("You cannot revoke your own super admin role");
    }
    await iam.adminRevokeRole(req.params.id, req.body.role, ctx(req));
    res.json({ ok: true });
  }),

  userSessions: asyncHandler(async (req: Request, res: Response) => {
    res.json(await iam.adminListUserSessions(req.params.id));
  }),

  revokeUserSessions: asyncHandler(async (req: Request, res: Response) => {
    await iam.revokeAllSessions(req.params.id, ctx(req), "revoked_by_admin");
    res.json({ ok: true });
  }),

  auditLogs: asyncHandler(async (req: Request, res: Response) => {
    res.json(
      await iam.listAuditLogs({
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
        category: req.query.category as never,
        action: typeof req.query.action === "string" ? req.query.action : undefined,
        userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
      }),
    );
  }),

  loginAttempts: asyncHandler(async (req: Request, res: Response) => {
    const rows = await loginAttemptRepo.list({
      limit: req.query.limit ? Number(req.query.limit) : 100,
      offset: req.query.offset ? Number(req.query.offset) : 0,
      success: req.query.success === undefined ? undefined : req.query.success === "true",
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        email: r.email,
        success: r.success,
        reason: r.reason,
        ip: r.ip,
        userAgent: r.user_agent,
        at: r.attempted_at,
      })),
    );
  }),
};
