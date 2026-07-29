import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "challenges";
const router = Router();

const challengeInput = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  total_distance_km: z.number().positive(),
  description_short: z.string().nullable().optional(),
  description_long: z.string().nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  activity_modes: z.array(z.string()).default([]),
  is_featured: z.boolean().optional(),
  is_new: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// Public list
router.get(
  "/",
  optionalAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize, status } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("sort_order", "asc");
    if (q) qb.whereILike("title", `%${q}%`);
    if (status === "published") qb.where({ is_active: true });
    if (status === "draft") qb.where({ is_active: false });
    else if (!req.user) qb.where({ is_active: true });
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.get(
  "/:idOrSlug",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { idOrSlug } = req.params;
    const qb = getDb()(TABLE).select("*");
    const isUuid = /^[0-9a-f]{8}-/i.test(idOrSlug);
    const row = await (isUuid ? qb.where({ id: idOrSlug }) : qb.where({ slug: idOrSlug })).first();
    if (!row) throw HttpError.notFound();
    res.json(ok(row));
  }),
);

router.get(
  "/:id/tickets",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const rows = await getDb()("challenge_tickets")
      .where({ challenge_id: req.params.id })
      .orderBy("price_inr", "asc");
    res.json(ok(rows));
  }),
);

router.get(
  "/:id/leaderboard",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const rows = await getDb().raw("select * from public.challenge_leaderboard(?, ?)", [
      req.params.id,
      limit,
    ]);
    res.json(ok(rows.rows ?? rows));
  }),
);

router.get(
  "/:id/progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await getDb().raw("select * from public.challenge_progress(?, ?)", [
      req.params.id,
      req.user!.sub,
    ]);
    res.json(ok((rows.rows ?? rows)[0] ?? null));
  }),
);

// Admin CRUD
router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(challengeInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE).insert(req.body).returning("*");
    res.status(201).json(ok(row));
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(challengeInput.partial()),
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
