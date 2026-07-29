import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, ensureFreshToken } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);

  // GET: Strava verification handshake. Strava is documented to echo our
  // verify_token, but in practice doesn't always include it — so we accept any
  // `hub.mode=subscribe` handshake. Real authenticity for activity POSTs is
  // enforced below via the `?token=<STRAVA_VERIFY_TOKEN>` query parameter.
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && challenge) {
      return new Response(JSON.stringify({ "hub.challenge": challenge }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // POST: activity event. Authenticity: require the verify token as a query param.
  // Fail closed — if STRAVA_VERIFY_TOKEN is unset, reject ALL POSTs rather than
  // accept anything. (Audit S-1)
  const expectedToken = Deno.env.get("STRAVA_VERIFY_TOKEN");
  const providedToken = url.searchParams.get("token");
  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    console.warn("[webhook] rejected unauthenticated POST");
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const event = await req.json();
    console.log("[webhook] event", JSON.stringify(event));

    if (event.object_type !== "activity") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Dedupe via strava_webhook_events.
    const { error: dedupeErr } = await admin
      .from("strava_webhook_events")
      .insert({
        event_time: event.event_time ?? Math.floor(Date.now() / 1000),
        object_id: event.object_id,
        object_type: event.object_type,
        aspect_type: event.aspect_type,
        owner_id: event.owner_id ?? null,
        updates: event.updates ?? null,
      });
    if (dedupeErr && (dedupeErr.code === "23505" || dedupeErr.message?.includes("duplicate"))) {
      console.log("[webhook] dedupe — already processed");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const { data: token } = await admin
      .from("strava_tokens")
      .select("*")
      .eq("strava_athlete_id", event.owner_id)
      .maybeSingle();
    if (!token) {
      await markProcessed(admin, event, "no_token");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (event.aspect_type === "delete") {
      const { error } = await admin.rpc("delete_strava_activity", {
        _user_id: token.user_id,
        _strava_activity_id: event.object_id,
      });
      if (error) console.error("[webhook] delete RPC failed", error);
      await markProcessed(admin, event, error ? error.message : null);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (event.aspect_type !== "create" && event.aspect_type !== "update") {
      await markProcessed(admin, event, "ignored_aspect");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const tokenRes = await ensureFreshToken(admin, token);
    if (!tokenRes.ok) {
      await markProcessed(admin, event, "reconnect_required");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const actRes = await fetch(
      `https://www.strava.com/api/v3/activities/${event.object_id}`,
      { headers: { Authorization: `Bearer ${tokenRes.access_token}` } },
    );
    const activity = await actRes.json();
    if (!actRes.ok) {
      console.error("[webhook] activity fetch failed", activity);
      await markProcessed(admin, event, "activity_fetch_failed");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const { data: ingestRes, error: ingestErr } = await admin.rpc("ingest_strava_activity", {
      _user_id: token.user_id,
      _activity: activity,
    });
    if (ingestErr) console.error("[webhook] ingest RPC failed", ingestErr);
    console.log("[webhook] ingest result", JSON.stringify(ingestRes));

    const ingest = (ingestRes ?? {}) as Record<string, unknown>;
    const okIngest = !ingestErr && (ingest.ok as boolean | undefined) === true;
    const inserted = (ingest.inserted as boolean | undefined) === true;
    const reason = (ingest.reason as string | undefined) ?? null;

    await admin.from("strava_sync_runs").insert({
      user_id: token.user_id,
      source: "webhook",
      finished_at: new Date().toISOString(),
      fetched: 1,
      imported: okIngest && inserted ? 1 : 0,
      duplicate: okIngest && !inserted ? 1 : 0,
      outside_window: reason === "no_matching_registration" ? 1 : 0,
      wrong_sport: 0,
      milestones_unlocked: Number((ingest.milestones_unlocked as number | undefined) ?? 0),
      completed: (ingest.completed as boolean | undefined) === true,
      status: ingestErr ? "failed" : okIngest ? "succeeded" : "skipped",
      reason: reason ?? (ingestErr ? "ingest_failed" : null),
      error: ingestErr ? ingestErr.message.slice(0, 1000) : null,
    });

    await admin
      .from("strava_tokens")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", token.user_id);

    await markProcessed(admin, event, ingestErr ? ingestErr.message : null);
    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("[webhook] error", e);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});

async function markProcessed(
  admin: SupabaseClient,
  event: { event_time?: number; object_id: number; aspect_type: string },
  error: string | null,
) {
  await admin
    .from("strava_webhook_events")
    .update({ processed_at: new Date().toISOString(), error })
    .eq("object_id", event.object_id)
    .eq("aspect_type", event.aspect_type)
    .eq("event_time", event.event_time ?? 0);
}
