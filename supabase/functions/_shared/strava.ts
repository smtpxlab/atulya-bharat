// Shared helpers for Strava edge functions.
import { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const ALLOWED_BY_MODE: Record<string, string[]> = {
  run: ["Run", "VirtualRun", "TrailRun"],
  walk: ["Walk", "Hike"],
  ride: ["Ride", "VirtualRide", "EBikeRide", "MountainBikeRide", "GravelRide"],
};

export function classifyType(sport: string): "run" | "walk" | "ride" | "other" {
  const s = (sport ?? "").toLowerCase();
  if (s === "run" || s === "virtualrun" || s === "trailrun") return "run";
  if (s === "walk" || s === "hike") return "walk";
  if (s === "ride" || s === "virtualride" || s === "ebikeride" || s === "mountainbikeride" || s === "gravelride") return "ride";
  return "other";
}

export type EnsureTokenResult =
  | { ok: true; access_token: string }
  | { ok: false; reason: "reconnect_required"; details?: unknown };

/**
 * Refresh the Strava token if it is within 60s of expiry.
 * Persists the new token, or marks `refresh_failed_at` on failure.
 */
export async function ensureFreshToken(
  admin: SupabaseClient,
  token: { user_id: string; access_token: string; refresh_token: string; expires_at: string },
): Promise<EnsureTokenResult> {
  const expires = new Date(token.expires_at).getTime();
  if (expires > Date.now() + 60_000) {
    return { ok: true, access_token: token.access_token };
  }
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("STRAVA_CLIENT_ID"),
      client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    await admin
      .from("strava_tokens")
      .update({ refresh_failed_at: new Date().toISOString() })
      .eq("user_id", token.user_id);
    return { ok: false, reason: "reconnect_required", details: data };
  }
  await admin
    .from("strava_tokens")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(data.expires_at * 1000).toISOString(),
      refresh_failed_at: null,
    })
    .eq("user_id", token.user_id);
  return { ok: true, access_token: data.access_token };
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// =============================================================
// Shared sync routine — used by strava-sync-manual and strava-cron-sync.
// Writes a `strava_sync_runs` row capturing the outcome.
// =============================================================

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
  registration_id?: string;
  total_km_logged?: number;
  target_km?: number;
  mode: "full" | "incremental";
}

async function startRun(
  admin: SupabaseClient,
  userId: string,
  source: SyncSource,
): Promise<string | undefined> {
  const { data, error } = await admin
    .from("strava_sync_runs")
    .insert({ user_id: userId, source, status: "running" })
    .select("id")
    .single();
  if (error) {
    console.error("[sync] failed to create run row", error);
    return undefined;
  }
  return data.id as string;
}

async function finishRun(
  admin: SupabaseClient,
  runId: string | undefined,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!runId) return;
  const { error } = await admin
    .from("strava_sync_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) console.error("[sync] failed to finish run row", error);
}

export async function syncUserActivities(
  admin: SupabaseClient,
  userId: string,
  source: SyncSource,
  opts: { fullMode?: boolean } = {},
): Promise<SyncResult> {
  const runId = await startRun(admin, userId, source);

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
    const { data: token } = await admin
      .from("strava_tokens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!token) {
      await finishRun(admin, runId, { status: "skipped", reason: "not_connected" });
      return { ...empty, reason: "not_connected" };
    }

    await admin.rpc("expire_registrations", { _user_id: userId });
    const { data: activeRows } = await admin.rpc("active_registration", { _user_id: userId });
    const active = Array.isArray(activeRows) ? activeRows[0] : activeRows;
    if (!active) {
      await finishRun(admin, runId, { status: "skipped", reason: "no_active_registration" });
      return { ...empty, reason: "no_active_registration" };
    }

    const windowStart = new Date(active.registered_at as string).getTime();
    const windowEnd = active.window_end
      ? new Date(active.window_end as string).getTime()
      : Date.now() + 365 * 24 * 60 * 60 * 1000;

    const tokenRes = await ensureFreshToken(admin, token);
    if (!tokenRes.ok) {
      await finishRun(admin, runId, { status: "failed", reason: "reconnect_required" });
      return { ...empty, reason: "reconnect_required" };
    }
    const accessToken = tokenRes.access_token;

    const isInitial = !token.last_synced_at || opts.fullMode === true;
    let afterUnix = Math.floor((windowStart - 2 * 60 * 1000) / 1000);
    if (!isInitial && token.last_synced_at) {
      const lastSync = new Date(token.last_synced_at).getTime();
      afterUnix = Math.max(afterUnix, Math.floor((lastSync - 24 * 60 * 60 * 1000) / 1000));
    }
    const beforeUnix = Math.floor(Math.min(windowEnd, Date.now()) / 1000);

    const all: unknown[] = [];
    let fetched = 0;
    let page = 1;
    const perPage = 100;
    const maxPages = isInitial ? 50 : 5;

    while (page <= maxPages) {
      const params = new URLSearchParams({
        per_page: String(perPage),
        page: String(page),
      });
      if (afterUnix > 0) params.set("after", String(afterUnix));
      if (beforeUnix > 0) params.set("before", String(beforeUnix));
      const listRes = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const activities = await listRes.json();
      if (!listRes.ok) {
        const msg = typeof activities === "object" ? JSON.stringify(activities) : String(activities);
        await finishRun(admin, runId, {
          status: "failed",
          reason: listRes.status === 429 ? "rate_limited" : "strava_api_error",
          error: msg.slice(0, 1000),
          fetched,
        });
        return { ...empty, reason: "strava_api_error", fetched };
      }
      if (!Array.isArray(activities) || activities.length === 0) break;
      fetched += activities.length;
      all.push(...activities);
      if (activities.length < perPage) break;
      page++;
    }

    let imported = 0, duplicate = 0, outsideWindow = 0, wrongSport = 0;
    let total_km_logged: number | undefined;
    let registration_id: string | undefined;
    let milestones_unlocked = 0;
    let completed = false;

    const CHUNK = 100;
    for (let i = 0; i < all.length; i += CHUNK) {
      const chunk = all.slice(i, i + CHUNK);
      const { data: res, error } = await admin.rpc("ingest_strava_activities", {
        _user_id: userId,
        _activities: chunk as unknown as Record<string, unknown>[],
      });
      if (error) {
        console.error("[sync] ingest_strava_activities failed", error);
        await finishRun(admin, runId, {
          status: "failed",
          reason: "ingest_failed",
          error: error.message.slice(0, 1000),
          fetched,
          imported,
          duplicate,
          outside_window: outsideWindow,
          wrong_sport: wrongSport,
        });
        return {
          ...empty,
          reason: "ingest_failed",
          fetched,
          imported,
          duplicate,
          outsideWindow,
          wrongSport,
        };
      }
      const r = (res ?? {}) as Record<string, number | string | boolean>;
      imported += Number(r.imported ?? 0);
      duplicate += Number(r.duplicate ?? 0);
      outsideWindow += Number(r.outsideWindow ?? 0);
      wrongSport += Number(r.wrongSport ?? 0);
      milestones_unlocked += Number(r.milestones_unlocked ?? 0);
      if (r.total_km_logged !== undefined && r.total_km_logged !== null) {
        total_km_logged = Number(r.total_km_logged);
      }
      if (r.registration_id) registration_id = String(r.registration_id);
      if (r.completed) completed = true;
    }

    await admin
      .from("strava_tokens")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", userId);

    await finishRun(admin, runId, {
      status: "succeeded",
      fetched,
      imported,
      duplicate,
      outside_window: outsideWindow,
      wrong_sport: wrongSport,
      milestones_unlocked,
      completed,
    });

    console.log(
      `[sync] user=${userId} src=${source} mode=${active.activity_mode} ` +
        `fetched=${fetched} imported=${imported} duplicate=${duplicate} ` +
        `outside=${outsideWindow} wrong=${wrongSport} ms=${milestones_unlocked} done=${completed}`,
    );

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
      registration_id: registration_id ?? (active.registration_id as string | undefined),
      total_km_logged: total_km_logged ?? Number(active.total_km_logged ?? 0),
      target_km: Number(active.distance_target_km ?? 0),
      mode: isInitial ? "full" : "incremental",
    };
  } catch (e) {
    console.error("[sync] unexpected error", e);
    await finishRun(admin, runId, {
      status: "failed",
      reason: "unexpected_error",
      error: (e as Error).message.slice(0, 1000),
    });
    return { ...empty, reason: "unexpected_error" };
  }
}
