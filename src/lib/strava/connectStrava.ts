import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Kicks off the Strava OAuth flow. Shared by Dashboard and RegistrationDetail
 * so any page can offer a "Connect Strava" button with identical behavior.
 */
export async function connectStrava(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("strava-config");
  if (error || !(data as any)?.client_id) {
    toast.error("Could not load Strava config");
    return;
  }
  const clientId = (data as any).client_id;
  const redirect = `${window.location.origin}/auth/strava/callback`;
  const state = crypto.randomUUID();
  try {
    sessionStorage.setItem("strava_oauth_state", state);
  } catch {
    /* ignore */
  }
  const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirect,
  )}&response_type=code&approval_prompt=force&state=${encodeURIComponent(
    state,
  )}&scope=${encodeURIComponent("read,profile:read_all,activity:read_all")}`;
  (window.top ?? window).location.href = url;
}
