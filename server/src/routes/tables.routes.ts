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

function applyFilters(qb: Knex.QueryBuilder, query: Record<string, unknown>, known?: Set<string>) {
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
    if (known && known.size && !known.has(column)) continue;
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


/**
 * PostgREST-ish `or=(title.ilike.%x%,slug.ilike.%x%)` or bare comma list.
 * Supports `col.is.null` / `col.not.is.null` too — the public challenge list
 * uses `end_at.is.null,end_at.gte.<now>` and previously dropped every row with
 * a blank end date because `is` was not a recognised operator here.
 */
function applyOr(qb: Knex.QueryBuilder, raw: string, known?: Set<string>) {
  const inner = raw.replace(/^\(/, "").replace(/\)$/, "");
  const parts = inner.split(",").filter(Boolean);
  qb.where((b: Knex.QueryBuilder) => {
    for (const part of parts) {
      const segs = part.split(".");
      const column = segs.shift() ?? "";
      let negate = false;
      if (segs[0] === "not") {
        negate = true;
        segs.shift();
      }
      const op = segs.shift() ?? "";
      const value = segs.join(".");
      if (!IDENT.test(column)) continue;
      if (known && known.size && !known.has(column)) continue;

      if (op === "is") {
        const v = coerce(value);
        if (v === null) negate ? b.orWhereNotNull(column) : b.orWhereNull(column);
        else negate ? b.orWhereNot(column, v as any) : b.orWhere(column, v as any);
        continue;
      }
      if (op === "in") {
        const list = value.replace(/^\(/, "").replace(/\)$/, "").split(",").map(coerce) as any[];
        negate ? b.orWhereNotIn(column, list) : b.orWhereIn(column, list);
        continue;
      }
      const sqlOp = OPS[op];
      if (!sqlOp) continue;
      const v = coerce(value);
      if (v === null) {
        negate ? b.orWhereNotNull(column) : b.orWhereNull(column);
      } else if (negate) {
        b.orWhereNot(column, sqlOp, v as any);
      } else {
        b.orWhere(column, sqlOp, v as any);
      }
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

/** Drop payload keys that do not exist as columns (schema drift tolerance). */
function pickKnown(body: any, known: Set<string>) {
  if (!body || typeof body !== "object" || !known.size) return body;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (known.has(k)) out[k] = v;
  return out;
}

const router = Router();

/**
 * The Railway database does not always carry every column the React app's
 * generated Supabase types expect (schema drift between the old hosted
 * project and the self-hosted dump). Selecting a missing column makes
 * Postgres throw, which surfaced as a blanket 500 on /admin/clubs. Introspect
 * the real columns once per table and quietly ignore unknown ones.
 */
const columnCache = new Map<string, Set<string>>();
async function tableColumns(table: string): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const result: any = await getDb().raw(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = ?",
    [table],
  );
  const cols = new Set<string>(
    ((result.rows ?? result) as any[]).map((r) => r.column_name as string),
  );
  columnCache.set(table, cols);
  return cols;
}

/** `alias:related_table!clubs_promoter_id_fkey(id, full_name)` */
type Embed = { alias: string; table: string; localKey: string; columns: string[] };

function parseSelect(raw: string): { columns: string[]; embeds: Embed[] } {
  const columns: string[] = [];
  const embeds: Embed[] = [];
  let depth = 0;
  let buf = "";
  const parts: string[] = [];
  for (const ch of raw) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf);

  for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^(?:([a-z0-9_]+)\s*:\s*)?([a-z0-9_]+)(?:!([a-z0-9_]+))?\s*\(([^)]*)\)$/i);
    if (m) {
      const [, alias, relTable, fk, inner] = m;
      const cols = inner
        .split(",")
        .map((c) => c.trim())
        .filter((c) => IDENT.test(c));
      // Derive the local FK column: `clubs_promoter_id_fkey` → `promoter_id`.
      let localKey = "";
      if (fk) {
        const stripped = fk.replace(/_fkey$/, "");
        const idx = stripped.indexOf("_");
        localKey = idx >= 0 ? stripped.slice(idx + 1) : stripped;
      }
      if (!localKey) localKey = `${relTable.replace(/s$/, "")}_id`;
      embeds.push({ alias: alias || relTable, table: relTable, localKey, columns: cols });
      continue;
    }
    if (IDENT.test(part)) columns.push(part);
  }
  return { columns, embeds };
}

async function hydrateEmbeds(parentTable: string, rows: any[], embeds: Embed[]) {
  if (!rows.length) return;
  const parentCols = await tableColumns(parentTable);
  for (const embed of embeds) {
    if (!ALLOWED.has(embed.table) && embed.table !== "profiles") continue;
    const relCols = await tableColumns(embed.table);
    if (!relCols.size) continue;

    // One-to-many (`challenges?select=...,challenge_tickets(ticket_price)`):
    // the FK lives on the child table, so return an array per parent row.
    const childKey = `${parentTable.replace(/s$/, "")}_id`;
    if (!parentCols.has(embed.localKey) && relCols.has(childKey)) {
      const ids = [...new Set(rows.map((r) => r.id).filter(Boolean))];
      const cols = embed.columns.filter((c) => relCols.has(c));
      if (!cols.includes(childKey)) cols.push(childKey);
      const children = ids.length
        ? await getDb()(embed.table)
            .whereIn(childKey, ids as any[])
            .select(cols.length ? cols : ["*"])
        : [];
      const grouped = new Map<string, any[]>();
      for (const child of children as any[]) {
        const key = child[childKey];
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(child);
      }
      for (const r of rows) r[embed.alias] = grouped.get(r.id) ?? [];
      continue;
    }

    const localKey = embed.localKey;
    const ids = [...new Set(rows.map((r) => r[localKey]).filter(Boolean))];
    if (!ids.length) {
      for (const r of rows) r[embed.alias] = null;
      continue;
    }
    const cols = embed.columns.filter((c) => relCols.has(c));
    if (!cols.includes("id") && relCols.has("id")) cols.push("id");
    const related = await getDb()(embed.table)
      .whereIn("id", ids as any[])
      .select(cols.length ? cols : ["*"]);
    const byId = new Map(related.map((r: any) => [r.id, r]));
    for (const r of rows) r[embed.alias] = byId.get(r[localKey]) ?? null;
  }
}

router.get(
  "/:table",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const table = req.params.table;
    assertTable(table);
    const q = req.query as Record<string, unknown>;

    const db = getDb();
    const known = await tableColumns(table);
    const base = db(table);
    applyFilters(base, q, known);
    if (typeof q.or === "string") applyOr(base, q.or, known);
    scopeForRead(table, req, base);

    const countQb = base.clone().clearSelect().clearOrder().count<{ count: string }[]>("* as count");

    let embeds: Embed[] = [];
    let select: string[] = ["*"];
    if (typeof q.select === "string" && q.select !== "*") {
      const parsed = parseSelect(q.select);
      embeds = parsed.embeds;
      const cols = parsed.columns.filter((c) => known.has(c));
      select = cols.length ? cols : ["*"];
      for (const embed of embeds) {
        if (select[0] === "*") continue;
        if (known.has(embed.localKey) && !select.includes(embed.localKey)) {
          select.push(embed.localKey);
        } else if (known.has("id") && !select.includes("id")) {
          // one-to-many embed: the child rows are matched on the parent id
          select.push("id");
        }
      }
    }
    base.select(select);

    if (typeof q.order === "string" && IDENT.test(q.order) && known.has(q.order)) {
      base.orderBy(q.order, q.direction === "desc" ? "desc" : "asc");
    }
    if (q.limit !== undefined) base.limit(Math.min(Number(q.limit) || 20, 1000));
    if (q.offset !== undefined) base.offset(Number(q.offset) || 0);

    const [rows, countRows] = await Promise.all([base, countQb]);
    await hydrateEmbeds(table, rows as any[], embeds);
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
    const known = await tableColumns(table);
    const payload = Array.isArray(req.body)
      ? req.body.map((r: any) => pickKnown(r, known))
      : pickKnown(req.body, known);
    const rows = await getDb()(table).insert(payload).returning("*");
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
    const known = await tableColumns(table);
    const qb = getDb()(table);
    applyFilters(qb, req.query as Record<string, unknown>, known);
    if (!isAdmin(req.user?.roles)) {
      const scopeCol = USER_SCOPED[table] ?? SELF_WRITE[table];
      if (scopeCol && table !== "club_social_links") qb.where(scopeCol, req.user!.sub);
    }
    const rows = await qb.update(pickKnown(req.body, known)).returning("*");
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
    const known = await tableColumns(table);
    const qb = getDb()(table);
    applyFilters(qb, req.query as Record<string, unknown>, known);
    if (!isAdmin(req.user?.roles)) {
      const scopeCol = USER_SCOPED[table] ?? SELF_WRITE[table];
      if (scopeCol && table !== "club_social_links") qb.where(scopeCol, req.user!.sub);
    }
    try {
      const rows = await qb.del().returning("*");
      res.json({ data: rows });
    } catch (err: any) {
      // 23503 = foreign_key_violation (row is still referenced elsewhere)
      if (err?.code === "23503") {
        throw HttpError.conflict(`Cannot delete from '${table}': the record is still in use`);
      }
      throw err;
    }
  }),
);

export default router;
