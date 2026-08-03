import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";
import { logManualActivity } from "../services/challenges/progress.service";


const TABLE = "activity_logs";
const router = Router();

const logInput = z.object({
  registration_id: z.string().uuid().nullable().optional(),
  challenge_id: z.string().uuid().nullable().optional(),
  activity_date: z.string().min(1),
  activity_type: z.enum(["run", "walk", "ride"]),
  distance_km: z.number().positive().max(500),
  notes: z.string().max(500).nullable().optional(),
});

router.get(
  "/mine",
  requireAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).where({ user_id: req.user!.sub }).orderBy("activity_date", "desc");
    const regId = req.query.registration_id as string | undefined;
    if (regId) qb.andWhere({ registration_id: regId });
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.post(
  "/",
  requireAuth,
  validate(logInput),
  asyncHandler(async (req, res) => {
    const { registration_id, activity_date, activity_type, distance_km, notes } = req.body;
    if (!registration_id) throw HttpError.badRequest("registration_id is required");
    const result = await logManualActivity(req.user!.sub, {
      registration_id,
      distance_km,
      activity_date,
      activity_type,
      notes: notes ?? null,
    });
    res.status(201).json(ok(result));
  }),
);


router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await getDb()(TABLE).where({ id: req.params.id }).first();
    if (!row) throw HttpError.notFound();
    if (row.user_id !== req.user!.sub && !(req.user!.roles ?? []).includes("admin"))
      throw HttpError.forbidden();
    if (row.source && row.source !== "manual" && !(req.user!.roles ?? []).includes("admin"))
      throw HttpError.forbidden("Cannot delete non-manual logs");
    await getDb()(TABLE).where({ id: req.params.id }).del();
    res.status(204).send();
  }),
);

// Admin
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("activity_date", "desc");
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

export default router;
