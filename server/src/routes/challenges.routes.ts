import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";
import {
  challengeLeaderboard,
  challengeProgress,
} from "../services/challenges/progress.service";


const TABLE = "challenges";
const router = Router();

const challengeInput = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  distance: z.number().positive(),
  challenge_type: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
  creative_image_url: z.string().nullable().optional(),
  about_map_image_url: z.string().nullable().optional(),
  route_map_image_url: z.string().nullable().optional(),
  certificate_image_url: z.string().nullable().optional(),
  bib_image_url: z.string().nullable().optional(),
  max_duration_days: z.number().int().nullable().optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  status: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  meta_keywords: z.array(z.string()).optional(),
});

// Public list
router.get(
  "/",
  optionalAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize, status } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("created_at", "desc");
    if (q) qb.whereILike("name", `%${q}%`);
    if (status === "published") qb.where({ status: true });
    else if (status === "draft") qb.where({ status: false });
    else if (!req.user) qb.where({ status: true });
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
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "asc");
    res.json(ok(rows));
  }),
);

router.get(
  "/:id/leaderboard",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    res.json(ok(await challengeLeaderboard(req.params.id, limit, offset)));
  }),
);

router.get(
  "/:id/progress",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(ok(await challengeProgress(req.user!.sub, req.params.id)));
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
