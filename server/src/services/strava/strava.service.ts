/**
 * Strava service — ports the Supabase edge functions:
 *   strava-connect, strava-disconnect, strava-athlete-stats, strava-sync-manual,
 *   strava-cron-sync, strava-webhook, strava-webhook-setup,
 *   strava-subscription-health, strava-config.
 *
 * All Strava-side calls preserve the historical semantics (auto-refresh 60s
 * before expiry, backfill window, dedupe via strava_webhook_events, etc.).
 * DB-side ingestion continues to call the existing PL/pgSQL functions
 * (`ingest_strava_activity`, `ingest_strava_activities`, `delete_strava_activity`,
 * `active_registration`, `expire_registrations`).
 */
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { getDb } from "../../config/db";
import { HttpError } from "../../utils/httpError";

const BASE = "https://www.strava.com";

export interface StravaToken {
  user_id: string;
  strava_athlete_id: number | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  last_synced_at: string | null;
}

export function isStravaConfigured(): boolean {
  return Boolean(env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET);
}

export function publicConfig() {
  return {
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: env.STRAVA_REDIRECT_URI,
    scope: "read,profile:read_all,activity:read_all",
  };
}

export function buildAuthUrl(state: string, scope = "read,profile:read_all,activity:read_all"): string {
  const url = new URL(`${BASE}/oauth/authorize`);
  url.searchParams.set("client_id", env.STRAVA_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.STRAVA_REDIRECT_URI);
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  return url.toString();
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    logger.error({ url, status: res.status, body }, "Strava call failed");
    throw new HttpError(res.status, "STRAVA_API_ERROR", "Strava API error", body);
  }
  return body;
}

async function exchangeCode(code: string): Promise<any> {
  return fetchJson(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
}

async function refreshToken(refresh_token: string): Promise<any> {
  return fetchJson(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });
}

/** Exchange OAuth code for tokens and upsert into `strava_tokens`. */
export async function connect(userId: string, code: string) {
  if (!isStravaConfigured()) throw new HttpError(503, "STRAVA_NOT_CONFIGURED", "Strava not configured");
  const tokenData = await exchangeCode(code);
  const { access_token, refresh_token, expires_at, athlete, scope } = tokenData;
  const db = getDb();
  try {
    await db("strava_tokens")
      .insert({
        user_id: userId,
        strava_athlete_id: athlete?.id ?? null,
        athlete_first_name: athlete?.firstname ?? null,
        athlete_last_name: athlete?.lastname ?? null,
        athlete_username: athlete?.username ?? null,
        athlete_avatar_url: athlete?.profile ?? athlete?.profile_medium ?? null,
        athlete_city: athlete?.city ?? null,
        athlete_country: athlete?.country ?? null,
        access_token,
        refresh_token,
        expires_at: new Date(expires_at * 1000),
        scope: scope ?? "read,profile:read_all,activity:read_all",
      })
      .onConflict("user_id")
      .merge();
  } catch (err: any) {
    if (err?.code === "23505") {
      throw new HttpError(409, "STRAVA_ATHLETE_IN_USE", "This Strava account is already linked to another user.");
    }
    throw err;
  }
  return { success: true };
}

export async function disconnect(userId: string) {
  const db = getDb();
  const token = await db("strava_tokens").where({ user_id: userId }).first();
  if (token?.access_token) {
    // Fire-and-forget deauthorize.
    fetch(`${BASE}/oauth/deauthorize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).catch((err) => logger.warn({ err }, "Strava deauthorize failed"));
  }
  await db("strava_tokens").where({ user_id: userId }).delete();
  return { success: true };
}

async function ensureFreshToken(token: StravaToken): Promise<string> {
  const expires = new Date(token.expires_at).getTime();
  if (expires > Date.now() + 60_000) return token.access_token;
  const db = getDb();
  try {
    const data = await refreshToken(token.refresh_token);
    await db("strava_tokens")
      .where({ user_id: token.user_id })
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(data.expires_at * 1000),
        refresh_failed_at: null,
      });
    return data.access_token;
  } catch (err) {
    await db("strava_tokens")
      .where({ user_id: token.user_id })
      .update({ refresh_failed_at: new Date() });
    throw new HttpError(401, "STRAVA_RECONNECT_REQUIRED", "Strava reconnect required", err);
  }
}

/** Return the Strava athlete stats for a user (proxy to /athletes/:id/stats). */
export async function athleteStats(userId: string) {
  const db = getDb();
  const token = await db("strava_tokens").where({ user_id: userId }).first();
  if (!token) throw new HttpError(404, "NOT_CONNECTED", "Strava not connected");
  const accessToken = await ensureFreshToken(token);
  const stats = await fetchJson(`${BASE}/api/v3/athletes/${token.strava_athlete_id}/stats`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return stats;
}

export type SyncSource = "manual" | "full" | "cron" | "webhook";

export interface SyncResult {
  ok: boolean;
  run_id?: string;
  reason?: string;
  fetched: number;
  imported: number;
  duplicate: number;
  outsideWindow: number;
  wrongSport: number;
  milestones_unlocked: number;
  completed: boolean;
  mode: "full" | "incremental";
}

/**
 * Full user activity sync (port of `syncUserActivities` from _shared/strava.ts).
 * Writes a `strava_sync_runs` row capturing the outcome.
 */
export async function syncUserActivities(
  userId: string,
  source: SyncSource,
  opts: { fullMode?: boolean } = {},
): Promise<SyncResult> {
  const db = getDb();
  const [{ id: runId }] = await db("strava_sync_runs")
    .insert({ user_id: userId, source, status: "running" })
    .returning("id");

  const empty: SyncResult = {
    ok: false,
    run_id: runId,
    fetched: 0,
    imported: 0,
    duplicate: 0,
    outsideWindow: 0,
    wrongSport: 0,
    milestones_unlocked: 0,
    completed: false,
    mode: opts.fullMode ? "full" : "incremental",
  };

  try {
    const token = await db("strava_tokens").where({ user_id: userId }).first();
    if (!token) {
      await db("strava_sync_runs")
        .where({ id: runId })
        .update({ status: "skipped", reason: "not_connected", finished_at: new Date() });
      return { ...empty, reason: "not_connected" };
    }

    await db.raw("select expire_registrations(?)", [userId]);
    const activeRes = await db.raw<{ rows: { active_registration: any }[] }>(
      "select active_registration(?) as active_registration",
      [userId],
    );
    const active = activeRes.rows?.[0]?.active_registration;
    if (!active) {
      await db("strava_sync_runs")
        .where({ id: runId })
        .update({ status: "skipped", reason: "no_active_registration", finished_at: new Date() });
      return { ...empty, reason: "no_active_registration" };
    }

    const windowStart = new Date(active.registered_at).getTime();
    const windowEnd = active.window_end
      ? new Date(active.window_end).getTime()
      : Date.now() + 365 * 24 * 60 * 60 * 1000;

    const accessToken = await ensureFreshToken(token);

    const isInitial = !token.last_synced_at || opts.fullMode === true;
    let afterUnix = Math.floor((windowStart - 2 * 60_000) / 1000);
    if (!isInitial && token.last_synced_at) {
      const lastSync = new Date(token.last_synced_at).getTime();
      afterUnix = Math.max(afterUnix, Math.floor((lastSync - 24 * 3600 * 1000) / 1000));
    }
    const beforeUnix = Math.floor(Math.min(windowEnd, Date.now()) / 1000);

    const all: any[] = [];
    let fetched = 0;
    let page = 1;
    const perPage = 100;
    const maxPages = isInitial ? 50 : 5;
    while (page <= maxPages) {
      const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
      if (afterUnix > 0) params.set("after", String(afterUnix));
      if (beforeUnix > 0) params.set("before", String(beforeUnix));
      const activities = await fetchJson(
        `${BASE}/api/v3/athlete/activities?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!Array.isArray(activities) || activities.length === 0) break;
      fetched += activities.length;
      all.push(...activities);
      if (activities.length < perPage) break;
      page++;
    }

    let imported = 0, duplicate = 0, outsideWindow = 0, wrongSport = 0, milestones_unlocked = 0;
    let completed = false;
    const CHUNK = 100;
    for (let i = 0; i < all.length; i += CHUNK) {
      const chunk = all.slice(i, i + CHUNK);
      const res = await db.raw<{ rows: { ingest_strava_activities: any }[] }>(
        "select ingest_strava_activities(?, ?::jsonb) as ingest_strava_activities",
        [userId, JSON.stringify(chunk)],
      );
      const r = res.rows?.[0]?.ingest_strava_activities ?? {};
      imported += Number(r.imported ?? 0);
      duplicate += Number(r.duplicate ?? 0);
      outsideWindow += Number(r.outsideWindow ?? 0);
      wrongSport += Number(r.wrongSport ?? 0);
      milestones_unlocked += Number(r.milestones_unlocked ?? 0);
      if (r.completed) completed = true;
    }

    await db("strava_tokens").where({ user_id: userId }).update({ last_synced_at: new Date() });
    await db("strava_sync_runs").where({ id: runId }).update({
      status: "succeeded",
      fetched,
      imported,
      duplicate,
      outside_window: outsideWindow,
      wrong_sport: wrongSport,
      milestones_unlocked,
      completed,
      finished_at: new Date(),
    });

    return {
      ok: true,
      run_id: runId,
      fetched,
      imported,
      duplicate,
      outsideWindow,
      wrongSport,
      milestones_unlocked,
      completed,
      mode: isInitial ? "full" : "incremental",
    };
  } catch (e) {
    logger.error({ err: e, userId }, "strava sync failed");
    await db("strava_sync_runs").where({ id: runId }).update({
      status: "failed",
      reason: "unexpected_error",
      error: (e as Error).message.slice(0, 1000),
      finished_at: new Date(),
    });
    return { ...empty, reason: "unexpected_error" };
  }
}

/** Webhook verification handshake. */
export function verifyHandshake(mode: string | null, token: string | null, challenge: string | null) {
  if (mode === "subscribe" && challenge) return { "hub.challenge": challenge };
  return null;
}

/** Assert POST authenticity via the shared verify token query param. */
export function assertWebhookToken(providedToken: string | null): void {
  if (!env.STRAVA_VERIFY_TOKEN || !providedToken || providedToken !== env.STRAVA_VERIFY_TOKEN) {
    throw new HttpError(403, "STRAVA_WEBHOOK_FORBIDDEN", "Forbidden");
  }
}

/** Process a Strava activity webhook event (idempotent via strava_webhook_events). */
export async function processWebhookEvent(event: any) {
  const db = getDb();
  if (event.object_type !== "activity") return { ok: true, skipped: "non_activity" };

  try {
    await db("strava_webhook_events").insert({
      event_time: event.event_time ?? Math.floor(Date.now() / 1000),
      object_id: event.object_id,
      object_type: event.object_type,
      aspect_type: event.aspect_type,
      owner_id: event.owner_id ?? null,
      updates: event.updates ?? null,
    });
  } catch (err: any) {
    if (err?.code === "23505") return { ok: true, deduped: true };
    throw err;
  }

  const token = await db("strava_tokens").where({ strava_athlete_id: event.owner_id }).first();
  if (!token) return { ok: true, skipped: "no_token" };

  if (event.aspect_type === "delete") {
    await db.raw("select delete_strava_activity(?, ?)", [token.user_id, event.object_id]);
    return { ok: true, deleted: true };
  }

  if (event.aspect_type !== "create" && event.aspect_type !== "update") {
    return { ok: true, skipped: "ignored_aspect" };
  }

  const accessToken = await ensureFreshToken(token);
  const activity = await fetchJson(`${BASE}/api/v3/activities/${event.object_id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const ingest = await db.raw<{ rows: { ingest_strava_activity: any }[] }>(
    "select ingest_strava_activity(?, ?::jsonb) as ingest_strava_activity",
    [token.user_id, JSON.stringify(activity)],
  );
  await db("strava_tokens").where({ user_id: token.user_id }).update({ last_synced_at: new Date() });
  return { ok: true, ingest: ingest.rows?.[0]?.ingest_strava_activity };
}

/** Enumerate users due for a scheduled Strava sync (has active registration). */
export async function usersDueForSync(): Promise<string[]> {
  const db = getDb();
  const rows = await db("strava_tokens as t")
    .join("registrations as r", "r.user_id", "t.user_id")
    .whereNull("t.refresh_failed_at")
    .andWhere("r.status", "active")
    .distinct("t.user_id");
  return rows.map((r: any) => r.user_id);
}

/** Get webhook subscription health from Strava. */
export async function subscriptionHealth() {
  if (!isStravaConfigured()) throw new HttpError(503, "STRAVA_NOT_CONFIGURED", "Strava not configured");
  return fetchJson(
    `${BASE}/api/v3/push_subscriptions?client_id=${env.STRAVA_CLIENT_ID}&client_secret=${env.STRAVA_CLIENT_SECRET}`,
    { method: "GET" },
  );
}
