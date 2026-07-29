import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "profiles";
const router = Router();

const updateProfileSchema = z
  .object({
    full_name: z.string().trim().max(200).nullable().optional(),
    username: z.string().trim().max(80).nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    mobile: z.string().max(30).nullable().optional(),
    gender: z.string().max(30).nullable().optional(),
    dob: z.string().nullable().optional(),
    house_no: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    pincode: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    shop_name: z.string().nullable().optional(),
  })
  .strict();

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await getDb()(TABLE).where({ id: req.user!.sub }).first();
    if (!row) throw HttpError.notFound("Profile not found");
    res.json(ok(row));
  }),
);

router.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE)
      .where({ id: req.user!.sub })
      .update({ ...req.body, updated_at: new Date() })
      .returning("*");
    res.json(ok(row));
  }),
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await getDb()(TABLE).where({ id: req.params.id }).first();
    if (!row) throw HttpError.notFound();
    res.json(ok(row));
  }),
);

// Admin list
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("created_at", "desc");
    if (q) qb.whereILike("full_name", `%${q}%`).orWhereILike("username", `%${q}%`);
    const result = await paginate(qb, page, pageSize);
    res.json(ok(result));
  }),
);

export default router;
