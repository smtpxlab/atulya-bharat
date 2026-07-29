import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "registrations";
const router = Router();

const registrationInput = z.object({
  challenge_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  activity_mode: z.enum(["run", "walk", "ride"]),
  target_days: z.number().int().min(1).max(365),
});

router.get(
  "/mine",
  requireAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, status } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).where({ user_id: req.user!.sub }).orderBy("created_at", "desc");
    if (status) qb.andWhere({ status });
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.get(
  "/active",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await getDb().raw("select * from public.active_registration(?)", [req.user!.sub]);
    res.json(ok((rows.rows ?? rows)[0] ?? null));
  }),
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await getDb()(TABLE).where({ id: req.params.id }).first();
    if (!row) throw HttpError.notFound();
    if (row.user_id !== req.user!.sub && !(req.user!.roles ?? []).includes("admin"))
      throw HttpError.forbidden();
    res.json(ok(row));
  }),
);

router.post(
  "/",
  requireAuth,
  validate(registrationInput),
  asyncHandler(async (req, res) => {
    const { challenge_id, ticket_id, activity_mode, target_days } = req.body;
    const result = await getDb().raw(
      "select * from public.register_for_challenge(?, ?, ?, ?, ?)",
      [req.user!.sub, challenge_id, ticket_id, activity_mode, target_days],
    );
    res.status(201).json(ok((result.rows ?? result)[0] ?? null));
  }),
);

router.post(
  "/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    await getDb().raw("select public.cancel_active_registration(?, ?)", [
      req.user!.sub,
      req.params.id,
    ]);
    res.json(ok({ id: req.params.id, cancelled: true }));
  }),
);

// Admin
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, status } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("created_at", "desc");
    if (status) qb.where({ status });
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

export default router;
