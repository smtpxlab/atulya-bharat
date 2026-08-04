import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";
import { adminBookingStats } from "../services/admin/admin.service";


const TABLE = "orders";
const router = Router();

const orderInput = z.object({
  challenge_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  amount: z.number().nonnegative(),
  currency: z.string().default("INR"),
  coupon_id: z.string().uuid().nullable().optional(),
  gateway_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
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
  validate(orderInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE)
      .insert({ ...req.body, user_id: req.user!.sub, status: "created" })
      .returning("*");
    res.status(201).json(ok(row));
  }),
);

// Admin
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize, status, q } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("created_at", "desc");
    if (status) qb.where({ status });
    if (q) qb.whereILike("booking_number", `%${q}%`);
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.get(
  "/admin/stats",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const challengeId = typeof req.query.challenge_id === "string" ? req.query.challenge_id : null;
    res.json(ok(await adminBookingStats(challengeId)));
  }),
);


export default router;
