// Daily probe: asks Strava whether our webhook push subscription still exists.
// Writes the result to `strava_subscription_health` so the admin dashboard
// can show a red light if Strava drops our subscription.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/strava.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const clientId = Deno.env.get("STRAVA_CLIENT_ID");
  const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  if (!clientId || !clientSecret) {
    await admin.from("strava_subscription_health").insert({
      status: "error",
      error: "missing_strava_credentials",
    });
    return json({ status: "error", error: "missing_strava_credentials" }, 500);
  }

  try {
    const url = `https://www.strava.com/api/v3/push_subscriptions?client_id=${encodeURIComponent(
      clientId,
    )}&client_secret=${encodeURIComponent(clientSecret)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      await admin.from("strava_subscription_health").insert({
        status: "error",
        error: typeof data === "object" ? JSON.stringify(data).slice(0, 500) : String(data),
        raw: data,
      });
      return json({ status: "error", details: data }, res.status);
    }

    const subs = Array.isArray(data) ? data : [];
    if (subs.length === 0) {
      await admin.from("strava_subscription_health").insert({
        status: "missing",
        raw: data,
      });
      return json({ status: "missing" });
    }

    const sub = subs[0];
    await admin.from("strava_subscription_health").insert({
      status: "ok",
      subscription_id: sub.id ?? null,
      callback_url: sub.callback_url ?? null,
      raw: data,
    });
    return json({ status: "ok", subscription: sub });
  } catch (e) {
    await admin.from("strava_subscription_health").insert({
      status: "error",
      error: (e as Error).message.slice(0, 500),
    });
    return json({ status: "error", error: (e as Error).message }, 500);
  }
});
