import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "newsletter_subscribers";
const router = Router();

router.post(
  "/subscribe",
  validate(z.object({ email: z.string().email(), source: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const result = await getDb().raw("select * from public.subscribe_to_newsletter(?, ?)", [
      req.body.email,
      req.body.source ?? null,
    ]);
    res.json(ok((result.rows ?? result)[0] ?? { ok: true }));
  }),
);

router.post(
  "/unsubscribe",
  validate(z.object({ email: z.string().email() })),
  asyncHandler(async (req, res) => {
    await getDb()(TABLE)
      .whereRaw("lower(email) = lower(?)", [req.body.email])
      .update({ status: "unsubscribed", unsubscribed_at: new Date(), updated_at: new Date() });
    res.json(ok({ ok: true }));
  }),
);

// Admin
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize, status } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("subscribed_at", "desc");
    if (q) qb.whereILike("email", `%${q}%`);
    if (status && status !== "all") qb.andWhere({ status });
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.get(
  "/stats",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const [{ total }] = await db(TABLE).count<{ total: string }[]>("* as total");
    const [{ active }] = await db(TABLE)
      .where({ status: "subscribed" })
      .count<{ active: string }[]>("* as active");
    const [{ unsubscribed }] = await db(TABLE)
      .where({ status: "unsubscribed" })
      .count<{ unsubscribed: string }[]>("* as unsubscribed");
    const [{ last30 }] = await db(TABLE)
      .whereRaw("subscribed_at > now() - interval '30 days'")
      .count<{ last30: string }[]>("* as last30");
    res.json(
      ok({
        total: Number(total),
        active: Number(active),
        unsubscribed: Number(unsubscribed),
        last30Days: Number(last30),
      }),
    );
  }),
);

export default router;
