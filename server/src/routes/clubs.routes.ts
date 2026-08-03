import { Router } from "express";
import { z } from "zod";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";

const TABLE = "clubs";
/** Railway databases restored from the schema dump may not contain the public
 *  helper functions. Fall back to plain SQL when the function is missing. */
const MISSING_FN = new Set(["42883", "42P01"]);
const CLUB_PUBLIC_COLS = [
  "id","slug","name","club_type","description","logo_url","banner_url","promoter_id",
  "promoter_name","promoter_city","promoter_state","promoter_description","established_at",
  "discount_challenge_percent","discount_cart_percent","social_links","tags","is_public",
  "status","priority","member_count","category_id","created_by","created_at","updated_at",
  "meta_title","meta_description","meta_keywords",
];
async function publicClubs(slug?: string) {
  try {
    const result = slug
      ? await getDb().raw("select * from public.get_public_club_by_slug(?)", [slug])
      : await getDb().raw("select * from public.list_public_clubs()");
    return (result as any).rows ?? result;
  } catch (err: any) {
    if (!MISSING_FN.has(err?.code)) throw err;
    const qb = getDb()("clubs").select(CLUB_PUBLIC_COLS);
    if (slug) return qb.where({ slug }).limit(1);
    return qb
      .where({ is_public: true, status: "approved" })
      .orderBy("priority", "desc")
      .orderBy("created_at", "desc");
  }
}

const router = Router();

const clubInput = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  club_type: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  banner_url: z.string().url().nullable().optional(),
  promoter_id: z.string().uuid().nullable().optional(),
  is_public: z.boolean().default(true),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  registration_code: z.string().nullable().optional(),
  referral_code: z.string().nullable().optional(),
  discount_challenge_percent: z.number().min(0).max(100).default(0),
  discount_cart_percent: z.number().min(0).max(100).default(0),
  established_at: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  social_links: z
    .array(z.object({ platform: z.string(), url: z.string().url() }))
    .optional(),
});

// Public list (uses list_public_clubs function)
router.get(
  "/",
  optionalAuth,
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const isAdmin = (req.user?.roles ?? []).includes("admin");
    if (isAdmin) {
      const qb = getDb()(TABLE).select("*").orderBy("priority", "desc").orderBy("created_at", "desc");
      return res.json(ok(await paginate(qb, page, pageSize)));
    }
    const rows = (await publicClubs()) as unknown[];
    res.json(ok({ items: rows, page: 1, pageSize: rows.length, total: rows.length }));
  }),
);

router.get(
  "/slug/:slug",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const rows = (await publicClubs(req.params.slug)) as any[];
    const row = rows[0];
    if (!row) throw HttpError.notFound();
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
    const socialLinks = await getDb()("club_social_links").where({ club_id: req.params.id });
    res.json(ok({ ...row, social_links: socialLinks }));
  }),
);

router.post(
  "/",
  requireAuth,
  validate(clubInput),
  asyncHandler(async (req, res) => {
    const { social_links, ...body } = req.body;
    const db = getDb();
    const row = await db.transaction(async (trx) => {
      const [inserted] = await trx(TABLE)
        .insert({ ...body, created_by: req.user!.sub })
        .returning("*");
      if (Array.isArray(social_links) && social_links.length) {
        await trx("club_social_links").insert(
          social_links.map((s: { platform: string; url: string }) => ({
            club_id: inserted.id,
            platform: s.platform,
            url: s.url,
          })),
        );
      }
      return inserted;
    });
    res.status(201).json(ok(row));
  }),
);

router.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(clubInput.partial()),
  asyncHandler(async (req, res) => {
    const { social_links, ...body } = req.body;
    const db = getDb();
    const row = await db.transaction(async (trx) => {
      const [updated] = await trx(TABLE)
        .where({ id: req.params.id })
        .update({ ...body, updated_at: new Date() })
        .returning("*");
      if (Array.isArray(social_links)) {
        await trx("club_social_links").where({ club_id: req.params.id }).del();
        if (social_links.length) {
          await trx("club_social_links").insert(
            social_links.map((s: { platform: string; url: string }) => ({
              club_id: req.params.id,
              platform: s.platform,
              url: s.url,
            })),
          );
        }
      }
      return updated;
    });
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

// Members
router.get(
  "/:id/members",
  requireAuth,
  asyncHandler(async (req, res) => {
    let result: any;
    try {
      result = await getDb().raw("select * from public.list_club_members(?)", [req.params.id]);
    } catch (err: any) {
      if (!MISSING_FN.has(err?.code)) throw err;
      const rows = await getDb()("club_members as cm")
        .leftJoin("profiles as p", "p.id", "cm.user_id")
        .where("cm.club_id", req.params.id)
        .orderBy("cm.joined_at", "asc")
        .select(
          "cm.id as membership_id",
          "cm.user_id",
          "cm.role",
          "cm.joined_at",
          getDb().raw("(cm.role = 'owner') as is_owner"),
          "p.full_name",
          "p.avatar_url",
          "p.city",
          getDb().raw("0::int as activities_count"),
          getDb().raw("coalesce(p.total_km_logged, 0) as total_distance_km"),
          getDb().raw("coalesce(p.challenges_completed, 0) as challenges_completed"),
        );
      result = { rows };
    }
    res.json(ok({ items: result.rows ?? result }));
  }),
);

router.post(
  "/:id/members",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [row] = await getDb()("club_members")
      .insert({
        club_id: req.params.id,
        user_id: req.user!.sub,
        role: "member",
      })
      .onConflict(["club_id", "user_id"])
      .ignore()
      .returning("*");
    res.status(201).json(ok(row ?? { joined: true }));
  }),
);

router.delete(
  "/:id/members/:memberId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = (req.user!.roles ?? []).includes("admin");
    const qb = getDb()("club_members").where({ id: req.params.memberId, club_id: req.params.id });
    if (!isAdmin) qb.andWhere({ user_id: req.user!.sub });
    await qb.del();
    res.status(204).send();
  }),
);

router.get(
  "/mine/list",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await getDb()("club_members as cm")
      .join("clubs as c", "c.id", "cm.club_id")
      .where({ "cm.user_id": req.user!.sub })
      .select("cm.id", "cm.club_id", "cm.joined_at", "c.name", "c.slug", "c.logo_url");
    res.json(ok(rows));
  }),
);

export default router;
