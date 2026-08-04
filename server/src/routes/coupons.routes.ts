import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";
import { validateCoupon } from "../services/coupons/coupon.service";


const TABLE = "coupons";
const router = Router();

const couponInput = z.object({
  coupon_name: z.string().min(1),
  coupon_type: z.enum(["fixed", "percent"]),
  coupon_value: z.number().nonnegative(),
  minimum_order_amount: z.number().nonnegative().default(0),
  coupon_frequency: z.number().int().nonnegative().default(0),
  details: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  status: z.boolean().default(true),
});

router.post(
  "/validate",
  requireAuth,
  validate(z.object({ code: z.string().min(1), amount: z.number().nonnegative() })),
  asyncHandler(async (req, res) => {
    res.json(ok(await validateCoupon(req.body.code, req.body.amount)));
  }),
);


// Admin CRUD
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("created_at", "desc");
    if (q) qb.whereILike("coupon_name", `%${q}%`);
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const row = await getDb()(TABLE).where({ id: req.params.id }).first();
    if (!row) throw HttpError.notFound();
    res.json(ok(row));
  }),
);

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(couponInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE).insert(req.body).returning("*");
    res.status(201).json(ok(row));
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(couponInput.partial()),
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
