import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing auth" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const { code } = await req.json();
    if (!code || typeof code !== "string") return json({ error: "Missing code" }, 400);

    // Exchange code for tokens
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("STRAVA_CLIENT_ID"),
        client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
        code,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Strava token exchange failed", tokenData);
      return json({ error: "Strava token exchange failed", details: tokenData }, 400);
    }

    const { access_token, refresh_token, expires_at, athlete, scope } = tokenData;

    // Use service role to upsert (bypasses RLS edge cases for unique key)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: upErr } = await admin.from("strava_tokens").upsert(
      {
        user_id: user.id,
        strava_athlete_id: athlete?.id ?? null,
        athlete_first_name: athlete?.firstname ?? null,
        athlete_last_name: athlete?.lastname ?? null,
        athlete_username: athlete?.username ?? null,
        athlete_avatar_url: athlete?.profile ?? athlete?.profile_medium ?? null,
        athlete_city: athlete?.city ?? null,
        athlete_country: athlete?.country ?? null,
        access_token,
        refresh_token,
        expires_at: new Date(expires_at * 1000).toISOString(),
        scope: scope ?? "read,profile:read_all,activity:read_all",
        // Intentionally do NOT set last_synced_at here so the first
        // strava-sync-manual run uses the historical backfill window.
      },
      { onConflict: "user_id" },
    );

    if (upErr) {
      console.error("Upsert error", upErr);
      if ((upErr as any)?.code === "23505") {
        return json({ error: "This Strava account is already linked to another user.", reason: "athlete_in_use" }, 409);
      }
      return json({ error: upErr.message }, 500);
    }


    return json({ success: true });
  } catch (e) {
    console.error("strava-connect error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
