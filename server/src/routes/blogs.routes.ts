import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "blog_posts";
const router = Router();

const postInput = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string().nullable().optional(),
  content_md: z.string().nullable().optional(),
  content_html: z.string().nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  author: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
  is_published: z.boolean().optional(),
  published_at: z.string().nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  meta_keywords: z.array(z.string()).default([]),
});

router.get(
  "/",
  optionalAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize, status } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("published_at", "desc");
    const isAdmin = (req.user?.roles ?? []).includes("admin");
    if (!isAdmin) qb.where({ status: "published", is_published: true });
    else if (status) qb.where({ status });
    if (q) qb.andWhere((b) => b.whereILike("title", `%${q}%`).orWhereILike("excerpt", `%${q}%`));
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
    if (!isAdmin && (row.status !== "published" || !row.is_published)) throw HttpError.notFound();
    res.json(ok(row));
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
  validate(postInput),
  asyncHandler(async (req, res) => {
    const [row] = await getDb()(TABLE)
      .insert({ ...req.body, author_id: req.user!.sub })
      .returning("*");
    res.status(201).json(ok(row));
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(postInput.partial()),
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
