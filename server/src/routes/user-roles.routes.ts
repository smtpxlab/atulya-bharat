import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { APP_ROLES, isAdmin, requireRole } from "../middleware/requireRole";
import { HttpError } from "../utils/httpError";

import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/list";

const router = Router();

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(APP_ROLES),
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await getDb()("user_roles").where({ user_id: req.user!.sub });
    res.json(ok(rows));
  }),
);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = (req.query.user_id as string | undefined) ?? undefined;
    // Anyone may read their own roles; listing other users' roles is admin-only.
    if (userId !== req.user!.sub && !isAdmin(req.user!.roles)) {
      throw HttpError.forbidden("Insufficient role");
    }
    const qb = getDb()("user_roles").select("*");
    if (userId) qb.where({ user_id: userId });
    res.json(ok(await qb));
  }),
);


router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()("user_roles")
      .insert(req.body)
      .onConflict(["user_id", "role"])
      .ignore()
      .returning("*");
    res.status(201).json(ok(row));
  }),
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await getDb()("user_roles").where({ id: req.params.id }).del();
    res.status(204).send();
  }),
);

export default router;
