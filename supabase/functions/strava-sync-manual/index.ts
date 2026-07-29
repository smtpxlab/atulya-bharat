import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, syncUserActivities } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    let body: { mode?: string } = {};
    try {
      if (req.headers.get("content-type")?.includes("application/json")) {
        body = await req.json();
      }
    } catch { /* no body — fine */ }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: ures } = await userClient.auth.getUser();
    const user = ures.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const fullMode = body.mode === "full";
    const result = await syncUserActivities(
      admin,
      user.id,
      fullMode ? "full" : "manual",
      { fullMode },
    );

    if (!result.ok && result.reason === "not_connected") {
      return json({ error: "Strava not connected" }, 400);
    }

    return json({
      imported: result.imported,
      duplicate: result.duplicate,
      outsideWindow: result.outsideWindow,
      wrongSport: result.wrongSport,
      // back-compat aliases
      synced: result.imported,
      fetched: result.fetched,
      skippedExisting: result.duplicate,
      skippedOutOfWindow: result.outsideWindow,
      skippedWrongSport: result.wrongSport,
      milestones_unlocked: result.milestones_unlocked,
      registration_id: result.registration_id,
      total_km_logged: result.total_km_logged,
      target_km: result.target_km,
      completed: result.completed,
      mode: result.mode,
      reason: result.reason,
      run_id: result.run_id,
    });
  } catch (e) {
    console.error("sync-manual error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
