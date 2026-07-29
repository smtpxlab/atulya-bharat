import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";

const StravaCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const error = params.get("error");
    const returnedState = params.get("state");
    let expectedState: string | null = null;
    try { expectedState = sessionStorage.getItem("strava_oauth_state"); } catch { /* ignore */ }
    try { sessionStorage.removeItem("strava_oauth_state"); } catch { /* ignore */ }

    if (error || !code) {
      toast.error(error ? `Strava error: ${error}` : "Missing authorization code");
      navigate("/dashboard", { replace: true });
      return;
    }
    if (expectedState && returnedState !== expectedState) {
      toast.error("Strava authentication failed (state mismatch). Please try again.");
      navigate("/dashboard", { replace: true });
      return;
    }

    (async () => {
      const { data, error: fnErr } = await supabase.functions.invoke("strava-connect", {
        body: { code },
      });
      if (fnErr || (data as any)?.error) {
        const msg = (data as any)?.error ?? fnErr?.message ?? "Failed to connect Strava";
        toast.error(
          msg?.includes?.("already") || (data as any)?.reason === "athlete_in_use"
            ? "This Strava account is already linked to another user."
            : msg,
        );
        navigate("/dashboard", { replace: true });
        return;
      }
      toast.success("Strava connected! Syncing your activities…");
      const { data: syncData, error: syncErr } = await supabase.functions.invoke("strava-sync-manual", {});
      const d = (syncData as any) ?? {};
      if (syncErr || d?.error) {
        toast.error("Connected, but initial sync failed. You can retry from the dashboard.");
      } else if (d.reason === "no_active_registration") {
        toast.message("Strava connected", { description: "Register for a challenge to start syncing activities." });
      } else if (d.reason === "reconnect_required") {
        toast.error("Please reconnect — your Strava token expired.");
      } else {
        const n = Number(d.imported ?? d.synced ?? 0);
        toast.success(n > 0 ? `Synced ${n} activit${n === 1 ? "y" : "ies"} from Strava` : "Strava is up to date");
      }
      navigate("/dashboard", { replace: true });
    })();
  }, [params, navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <SEO title="Connecting Strava… | Atulya Bharat Run" noindex />
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Connecting your Strava account…
      </div>
    </div>
  );
};

export default StravaCallback;
