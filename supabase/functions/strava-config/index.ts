const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const client_id = Deno.env.get("STRAVA_CLIENT_ID");
  if (!client_id) {
    return new Response(JSON.stringify({ error: "STRAVA_CLIENT_ID not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ client_id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
