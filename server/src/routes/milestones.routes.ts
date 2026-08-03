import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "challenge_milestones";
const router = Router();

const milestoneInput = z.object({
  challenge_id: z.string().uuid(),
  spot_name: z.string().min(1),
  distance: z.number().nonnegative(),
  description: z.string().nullable().optional(),
  spot_image_url: z.string().nullable().optional(),
  audio_url: z.string().nullable().optional(),
  status: z.boolean().optional(),
  sort_order: z.number().int().nullable().optional(),
  x_percent: z.number().nullable().optional(),
  y_percent: z.number().nullable().optional(),
  marker_icon: z.string().nullable().optional(),
  marker_color: z.string().nullable().optional(),
  marker_size: z.string().nullable().optional(),
  custom_label_position: z.string().nullable().optional(),
});

router.get(
  "/",
  optionalAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const challengeId = (req.query.challenge_id as string | undefined) ?? null;
    const qb = getDb()(TABLE).select("*").orderBy("sort_order", "asc").orderBy("distance", "asc");
    if (challengeId) qb.where({ challenge_id: challengeId });
    if (q) qb.andWhere((b) => b.whereILike("spot_name", `%${q}%`).orWhereILike("description", `%${q}%`));
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);


router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const row = await getDb()(TABLE).where({ id: req.params.id }).first();
    if (!row) throw HttpError.notFound();
    const media = await getDb()("milestone_media").where({ milestone_id: req.params.id });
    res.json(ok({ ...row, media }));
  }),
);

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(milestoneInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE).insert(req.body).returning("*");
    res.status(201).json(ok(row));
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(milestoneInput.partial()),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE)
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
    await getDb()(TABLE).where({ id: req.params.id }).del();
    res.status(204).send();
  }),
);

export default router;
