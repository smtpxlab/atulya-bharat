import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const router = Router();

const notificationInput = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  status: z.boolean().default(true),
});

// Public / published notifications
router.get(
  "/",
  optionalAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()("notifications").select("*").orderBy("created_at", "desc");
    const isAdmin = (req.user?.roles ?? []).includes("admin");
    if (!isAdmin) qb.where({ status: true, is_published: true });
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

// Current user's notifications
router.get(
  "/mine",
  requireAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()("user_notifications")
      .where({ user_id: req.user!.sub })
      .orderBy("created_at", "desc");
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.post(
  "/mine/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [row] = await getDb()("user_notifications")
      .where({ id: req.params.id, user_id: req.user!.sub })
      .update({ read_at: new Date() })
      .returning("*");
    if (!row) throw HttpError.notFound();
    res.json(ok(row));
  }),
);

// Admin CRUD
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(notificationInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()("notifications").insert(req.body).returning("*");
    res.status(201).json(ok(row));
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(notificationInput.partial().extend({ is_published: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()("notifications")
      .where({ id: req.params.id })
      .update({ ...req.body, updated_at: new Date() })
      .returning("*");
    if (!row) throw HttpError.notFound();
    res.json(ok(row));
  }),
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await getDb()("notifications").where({ id: req.params.id }).del();
    res.status(204).send();
  }),
);

export default router;
