import { supabase } from "@/integrations/supabase/client";
import { toServiceError } from "./errors";

export const stravaConnect = async (code: string): Promise<void> => {
  const { error } = await supabase.functions.invoke("strava-connect", { body: { code } });
  if (error) throw toServiceError(error, "Could not connect Strava");
};

export type StravaSyncResult = {
  synced: number;
  skippedExisting?: number;
  fetched?: number;
  pages?: number;
  mode?: "full" | "incremental";
};

export const stravaSyncManual = async (mode?: "full"): Promise<StravaSyncResult> => {
  const { data, error } = await supabase.functions.invoke("strava-sync-manual", {
    body: mode ? { mode } : {},
  });
  if (error) throw toServiceError(error, "Strava sync failed");
  return (data as StravaSyncResult) ?? { synced: 0 };
};

export const stravaDisconnect = async (): Promise<void> => {
  const { data, error } = await supabase.functions.invoke("strava-disconnect", {});
  if (error || (data as any)?.error) {
    throw toServiceError(error ?? new Error((data as any)?.error), "Could not disconnect Strava");
  }
};

export type StravaAthleteStats = {
  athlete: {
    id: number;
    firstname: string | null;
    lastname: string | null;
    avatar: string | null;
    city: string | null;
    country: string | null;
  } | null;
  scope: string | null;
  totals: {
    all_activities: number;
    all_distance_km: number;
    ytd_distance_km: number;
    this_month_distance_km: number;
    recent_4w_distance_km: number;
    first_activity_date: string | null;
    last_activity_date: string | null;
  };
  recent: Array<{
    id: number | string;
    name: string;
    distance_km: number;
    moving_time_seconds: number;
    sport_type: string | null;
    start_date: string | null;
    source?: string;
  }>;
};

export const stravaAthleteStats = async (): Promise<StravaAthleteStats | null> => {
  const { data, error } = await supabase.functions.invoke("strava-athlete-stats", {});
  if (error || (data as any)?.error) return null;
  return data as StravaAthleteStats;
};
