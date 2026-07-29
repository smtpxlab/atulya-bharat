// Hourly scheduled sync: iterates connected athletes with an active token
// (and no refresh failure) and runs an incremental sync for each.
// Logs each per-user attempt to `strava_sync_runs` via the shared helper.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, syncUserActivities } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only sync athletes whose tokens are still healthy.
    const { data: tokens, error } = await admin
      .from("strava_tokens")
      .select("user_id, last_synced_at, refresh_failed_at")
      .is("refresh_failed_at", null)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(200);

    if (error) return json({ error: error.message }, 500);

    const results: Array<Record<string, unknown>> = [];
    for (const t of tokens ?? []) {
      const r = await syncUserActivities(admin, t.user_id as string, "cron");
      results.push({
        user_id: t.user_id,
        ok: r.ok,
        fetched: r.fetched,
        imported: r.imported,
        duplicate: r.duplicate,
        reason: r.reason,
      });
    }

    return json({ checked: tokens?.length ?? 0, results });
  } catch (e) {
    console.error("strava-cron-sync error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
