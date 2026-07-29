const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// One-time helper to register/list/delete the Strava push subscription.
// Call:
//   GET  ?action=list   — list current subscriptions
//   POST { action: "create", callback_url: "https://<project>.supabase.co/functions/v1/strava-webhook" }
//   POST { action: "delete", id: <subscription_id> }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clientId = Deno.env.get("STRAVA_CLIENT_ID")!;
  const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET")!;
  const verifyToken = Deno.env.get("STRAVA_VERIFY_TOKEN")!;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ??
      (req.method === "POST" ? (await req.clone().json()).action : null);

    if (action === "list") {
      const r = await fetch(
        `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`,
      );
      return json(await r.json(), r.status);
    }

    if (action === "create") {
      let body: { callback_url?: string } = {};
      try { body = await req.json(); } catch { /* allow empty body */ }
      let callback = body.callback_url;
      if (!callback) {
        const supaUrl = Deno.env.get("SUPABASE_URL");
        if (!supaUrl) return json({ error: "callback_url required" }, 400);
        callback = `${supaUrl}/functions/v1/strava-webhook`;
      }
      // The webhook validates POSTs by requiring `?token=<STRAVA_VERIFY_TOKEN>`,
      // so make sure the callback URL we register with Strava includes it.
      const cbUrl = new URL(callback);
      if (!cbUrl.searchParams.get("token")) cbUrl.searchParams.set("token", verifyToken);

      const qs = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: cbUrl.toString(),
        verify_token: verifyToken,
      });
      const r = await fetch(
        `https://www.strava.com/api/v3/push_subscriptions?${qs.toString()}`,
        { method: "POST" },
      );
      return json(await r.json(), r.status);
    }

    if (action === "delete") {
      const body = await req.json();
      const id = body.id;
      if (!id) return json({ error: "id required" }, 400);
      const r = await fetch(
        `https://www.strava.com/api/v3/push_subscriptions/${id}?client_id=${clientId}&client_secret=${clientSecret}`,
        { method: "DELETE" },
      );
      return json({ deleted: r.ok }, r.status);
    }

    return json({ error: "Unknown action. Use list | create | delete" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
