import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "gallery_images";
const router = Router();

const galleryInput = z.object({
  image_url: z.string().url().optional(),
  storage_url: z.string().url().optional(),
  caption: z.string().nullable().optional(),
  event_name: z.string().nullable().optional(),
  challenge_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().default(0),
});

router.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("sort_order", "asc").orderBy("uploaded_at", "desc");
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(galleryInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE).insert(req.body).returning("*");
    res.status(201).json(ok(row));
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
