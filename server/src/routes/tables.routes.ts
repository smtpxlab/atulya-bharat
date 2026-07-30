import { Router } from "express";
import type { Knex } from "knex";
import { getDb } from "../config/db";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { isAdmin } from "../middleware/requireRole";
import { HttpError } from "../utils/httpError";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * Generic PostgREST-compatible table endpoint.
 *
 * The React app talks to the database through a Supabase-shaped shim
 * (`src/integrations/backend/from.ts`) which emits calls of the form
 *   GET /tables/:table?select=…&order=…&direction=…&limit=…&offset=…&col.op=value
 * Dedicated REST routes cover only a handful of domains, so without this
 * catch-all every admin list screen renders empty (404 → no rows).
 *
 * Authorization is enforced per table here, replacing the Postgres RLS
 * policies that no longer exist on the self-hosted database.
 */

/** Tables readable by anyone (they back public marketing/browse pages). */
const PUBLIC_READ = new Set([
  "challenges",
  "challenge_milestones",
  "challenge_tickets",
  "milestone_media",
  "blog_posts",
  "pages",
  "gallery_images",
  "faqs",
  "testimonials",
  "notifications",
  "clubs",
  "club_members",
  "club_social_links",
]);

/** Tables scoped to the signed-in user via the given column. */
const USER_SCOPED: Record<string, string> = {
  profiles: "id",
  registrations: "user_id",
  activity_logs: "user_id",
  user_milestones: "user_id",
  user_notifications: "user_id",
  user_roles: "user_id",
  orders: "user_id",
  strava_tokens: "user_id",
  strava_sync_runs: "user_id",
};

/** Admin-only tables (no public or self-service access at all). */
const ADMIN_ONLY = new Set([
  "coupons",
  "payment_gateways",
  "contact_enquiries",
  "newsletter_subscribers",
  "strava_webhook_events",
  "strava_subscription_health",
  "audit_logs",
  "login_attempts",
  "user_devices",
  "app_users",
]);

const ALLOWED = new Set<string>([
  ...PUBLIC_READ,
  ...Object.keys(USER_SCOPED),
  ...ADMIN_ONLY,
]);

const OPS: Record<string, string> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "like",
  ilike: "ilike",
};

const RESERVED = new Set([
  "select",
  "order",
  "direction",
  "limit",
  "offset",
  "or",
  "count",
]);

const IDENT = /^[a-z0-9_]+$/i;

const coerce = (raw: string): unknown => {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
};

function applyFilters(qb: Knex.QueryBuilder, query: Record<string, unknown>) {
  for (const [key, rawValue] of Object.entries(query)) {
    if (RESERVED.has(key)) continue;
    const idx = key.lastIndexOf(".");
    if (idx <= 0) continue;
    let column = key.slice(0, idx);
    let op = key.slice(idx + 1);
    // Negated filters arrive as `col.not.<op>` (client `.not(col, op, value)`).
    let negate = false;
    if (column.endsWith(".not")) {
      negate = true;
      column = column.slice(0, -4);
    }
    if (!IDENT.test(column)) continue;
    const value = String(rawValue);

    if (op === "in") {
      const list = value.split(",").map(coerce) as any[];
      if (negate) qb.whereNotIn(column, list);
      else qb.whereIn(column, list);
      continue;
    }
    if (op === "is") {
      const v = coerce(value);
      if (v === null) negate ? qb.whereNotNull(column) : qb.whereNull(column);
      else negate ? qb.whereNot(column, v as any) : qb.where(column, v as any);
      continue;
    }
    if (op === "contains") {
      // array containment (tags)
      if (negate) qb.whereRaw("not (?? @> ?)", [column, value.split(",")]);
      else qb.whereRaw("?? @> ?", [column, value.split(",")]);
      continue;
    }
    const sqlOp = OPS[op];
    if (!sqlOp) continue;
    const v = coerce(value);
    if (v === null) {
      negate ? qb.whereNotNull(column) : qb.whereNull(column);
    } else if (negate) {
      qb.whereNot(column, sqlOp, v as any);
    } else {
      qb.where(column, sqlOp, v as any);
    }
  }
}


/** PostgREST-ish `or=(title.ilike.%x%,slug.ilike.%x%)` or bare comma list. */
function applyOr(qb: Knex.QueryBuilder, raw: string) {
  const inner = raw.replace(/^\(/, "").replace(/\)$/, "");
  const parts = inner.split(",").filter(Boolean);
  qb.where((b) => {
    for (const part of parts) {
      const [column, op, ...rest] = part.split(".");
      const value = rest.join(".");
      if (!IDENT.test(column ?? "")) continue;
      const sqlOp = OPS[op ?? ""];
      if (!sqlOp) continue;
      b.orWhere(column, sqlOp, coerce(value) as any);
    }
  });
}

function assertTable(table: string) {
  if (!IDENT.test(table) || !ALLOWED.has(table)) {
    throw HttpError.notFound(`Unknown table '${table}'`);
  }
}

function scopeForRead(table: string, req: any, qb: Knex.QueryBuilder) {
  if (isAdmin(req.user?.roles)) return;
  const scopeCol = USER_SCOPED[table];
  if (scopeCol) {
    if (!req.user) throw HttpError.unauthorized();
    // `profiles` is publicly readable (leaderboards, club member lists);
    // every other user-scoped table is restricted to the owner's rows.
    if (table !== "profiles") qb.where(scopeCol, req.user.sub);
    return;
  }
  if (!PUBLIC_READ.has(table)) throw HttpError.forbidden("Insufficient role");
}

/** Tables any signed-in user may write, as long as the row is their own. */
const SELF_WRITE: Record<string, string> = {
  clubs: "created_by",
  club_members: "user_id",
  club_social_links: "club_id",
};

function assertWrite(table: string, req: any, body: any) {
  if (isAdmin(req.user?.roles)) return;
  const scopeCol = USER_SCOPED[table] ?? SELF_WRITE[table];
  if (!scopeCol || table === "user_roles") throw HttpError.forbidden("Insufficient role");
  if (table === "club_social_links") return; // ownership enforced by the club row itself
  const rows = Array.isArray(body) ? body : [body];
  for (const row of rows) {
    if (row && row[scopeCol] && row[scopeCol] !== req.user.sub) {
      throw HttpError.forbidden("Cannot write rows owned by another user");
    }
  }
}

const router = Router();

router.get(
  "/:table",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    assertTable(table);
    const q = req.query as Record<string, unknown>;

    const db = getDb();
    const base = db(table);
    applyFilters(base, q);
    if (typeof q.or === "string") applyOr(base, q.or);
    scopeForRead(table, req, base);

    const countQb = base.clone().clearSelect().clearOrder().count<{ count: string }[]>("* as count");

    const select =
      typeof q.select === "string" && q.select !== "*"
        ? q.select
            .split(",")
            .map((c) => c.trim())
            .filter((c) => IDENT.test(c))
        : ["*"];
    base.select(select.length ? select : ["*"]);

    if (typeof q.order === "string" && IDENT.test(q.order)) {
      base.orderBy(q.order, q.direction === "desc" ? "desc" : "asc");
    }
    if (q.limit !== undefined) base.limit(Math.min(Number(q.limit) || 20, 1000));
    if (q.offset !== undefined) base.offset(Number(q.offset) || 0);

    const [rows, countRows] = await Promise.all([base, countQb]);
    const total = Number((countRows as any)?.[0]?.count ?? (rows as any[]).length);
    res.json({ data: rows, count: total });
  }),
);

router.post(
  "/:table",
  requireAuth,
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    assertTable(table);
    assertWrite(table, req, req.body);
    const rows = await getDb()(table).insert(req.body).returning("*");
    res.status(201).json({ data: Array.isArray(req.body) ? rows : rows[0] });
  }),
);

router.patch(
  "/:table",
  requireAuth,
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    assertTable(table);
    assertWrite(table, req, req.body);
    const qb = getDb()(table);
    applyFilters(qb, req.query as Record<string, unknown>);
    if (!isAdmin(req.user?.roles)) {
      const scopeCol = USER_SCOPED[table] ?? SELF_WRITE[table];
      if (scopeCol && table !== "club_social_links") qb.where(scopeCol, req.user!.sub);
    }
    const rows = await qb.update(req.body).returning("*");
    res.json({ data: rows });
  }),
);

router.delete(
  "/:table",
  requireAuth,
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    assertTable(table);
    assertWrite(table, req, {});
    const qb = getDb()(table);
    applyFilters(qb, req.query as Record<string, unknown>);
    if (!isAdmin(req.user?.roles)) {
      const scopeCol = USER_SCOPED[table] ?? SELF_WRITE[table];
      if (scopeCol && table !== "club_social_links") qb.where(scopeCol, req.user!.sub);
    }
    const rows = await qb.del().returning("*");
    res.json({ data: rows });
  }),
);

export default router;
