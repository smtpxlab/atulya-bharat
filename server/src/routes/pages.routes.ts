import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "pages";
const router = Router();

const pageInput = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  content: z.string(),
  status: z.enum(["enabled", "disabled"]).default("enabled"),
});

router.get(
  "/",
  optionalAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("id", "title", "slug", "status", "created_at", "updated_at");
    const isAdmin = (req.user?.roles ?? []).includes("admin");
    if (!isAdmin) qb.where({ status: "enabled" });
    if (q) qb.andWhereILike("title", `%${q}%`);
    qb.orderBy("updated_at", "desc");
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.get(
  "/slug/:slug",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const row = await getDb()(TABLE).where({ slug: req.params.slug }).first();
    if (!row) throw HttpError.notFound();
    const isAdmin = (req.user?.roles ?? []).includes("admin");
    if (!isAdmin && row.status !== "enabled") throw HttpError.notFound();
    res.json(ok(row));
  }),
);

router.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(pageInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE)
      .insert({ ...req.body, created_by: req.user!.sub })
      .returning("*");
    res.status(201).json(ok(row));
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(pageInput.partial()),
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
