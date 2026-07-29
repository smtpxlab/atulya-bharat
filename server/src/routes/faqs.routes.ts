import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "faqs";
const router = Router();

const faqInput = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  status: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

router.get(
  "/",
  optionalAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("sort_order", "asc");
    const isAdmin = (req.user?.roles ?? []).includes("admin");
    if (!isAdmin) qb.where({ status: true });
    if (q) qb.andWhereILike("question", `%${q}%`);
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(faqInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE).insert(req.body).returning("*");
    res.status(201).json(ok(row));
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(faqInput.partial()),
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
