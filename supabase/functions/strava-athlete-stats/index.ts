import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, ensureFreshToken, json } from "../_shared/strava.ts";



function round1(n: number) {
  return Number((n || 0).toFixed(1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

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

    const { data: token } = await admin
      .from("strava_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!token) return json({ error: "Strava not connected" }, 400);

    // Refresh athlete profile (avatar/name/location). Non-fatal — but if the
    // refresh-token is dead we surface `reconnect_required` so the UI can prompt.
    let athletePayload: any = null;
    let reconnectRequired = false;
    const tokenRes = await ensureFreshToken(admin, token);
    if (!tokenRes.ok) {
      reconnectRequired = true;
    } else {
      try {
        const athleteRes = await fetch("https://www.strava.com/api/v3/athlete", {
          headers: { Authorization: `Bearer ${tokenRes.access_token}` },
        });
        if (athleteRes.ok) {
          const athlete = await athleteRes.json();
          athletePayload = {
            id: athlete.id,
            firstname: athlete.firstname,
            lastname: athlete.lastname,
            avatar: athlete.profile ?? athlete.profile_medium ?? null,
            city: athlete.city ?? null,
            country: athlete.country ?? null,
          };
          await admin
            .from("strava_tokens")
            .update({
              athlete_avatar_url: athlete.profile ?? athlete.profile_medium ?? token.athlete_avatar_url,
              athlete_username: athlete.username ?? token.athlete_username,
              athlete_city: athlete.city ?? token.athlete_city,
              athlete_country: athlete.country ?? token.athlete_country,
              athlete_first_name: athlete.firstname ?? token.athlete_first_name,
              athlete_last_name: athlete.lastname ?? token.athlete_last_name,
            })
            .eq("user_id", user.id);
        } else {
          console.warn("[athlete-stats] athlete fetch failed", athleteRes.status);
        }
      } catch (e) {
        console.warn("[athlete-stats] athlete refresh skipped:", (e as Error).message);
      }
    }



    // Aggregate from our own activity_logs — single source of truth.
    const { data: rows, error: aggErr } = await admin
      .from("activity_logs")
      .select("id, distance_km, activity_date, activity_type, sport_type, start_date, source, strava_activity_id")
      .eq("user_id", user.id)
      .order("activity_date", { ascending: false })
      .order("start_date", { ascending: false });

    if (aggErr) {
      console.error("[athlete-stats] activity_logs query failed", aggErr);
      return json({ error: "Failed to load activities" }, 500);
    }

    const today = new Date();
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = ymd(today);
    const monthStart = ymd(new Date(today.getFullYear(), today.getMonth(), 1));
    const yearStart = `${today.getFullYear()}-01-01`;
    const fourWeeksAgo = ymd(new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000));

    let all_distance_km = 0;
    let ytd_distance_km = 0;
    let month_distance_km = 0;
    let recent_4w_distance_km = 0;
    let first_activity_date: string | null = null;
    let last_activity_date: string | null = null;

    for (const r of rows ?? []) {
      const km = Number(r.distance_km) || 0;
      const d = String(r.activity_date);
      all_distance_km += km;
      if (d >= yearStart) ytd_distance_km += km;
      if (d >= monthStart) month_distance_km += km;
      if (d >= fourWeeksAgo && d <= todayStr) recent_4w_distance_km += km;
      if (!last_activity_date || d > last_activity_date) last_activity_date = d;
      if (!first_activity_date || d < first_activity_date) first_activity_date = d;
    }

    const totals = {
      all_activities: rows?.length ?? 0,
      all_distance_km: round1(all_distance_km),
      ytd_distance_km: round1(ytd_distance_km),
      this_month_distance_km: round1(month_distance_km),
      recent_4w_distance_km: round1(recent_4w_distance_km),
      first_activity_date,
      last_activity_date,
    };

    const recent = (rows ?? []).slice(0, 5).map((r: any) => ({
      id: r.strava_activity_id ?? r.id,
      name: r.sport_type ?? r.activity_type ?? "Activity",
      distance_km: Number(Number(r.distance_km).toFixed(2)),
      moving_time_seconds: 0,
      sport_type: r.sport_type ?? r.activity_type ?? null,
      start_date: r.start_date ?? r.activity_date,
      source: r.source,
    }));

    console.log(
      `[athlete-stats] user=${user.id} totals=`,
      JSON.stringify({ ...totals, recent_count: recent.length }),
    );

    return json({
      athlete: athletePayload,
      scope: token.scope ?? null,
      totals,
      recent,
      reason: reconnectRequired ? "reconnect_required" : undefined,
    });
  } catch (e) {
    console.error("strava-athlete-stats error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

