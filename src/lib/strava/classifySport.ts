// Shared sport classification between sync (edge function) and dashboard/challenge logic.
// Mirrors the mapping used by supabase/functions/strava-sync-manual/index.ts.

export type InternalActivityType = "run" | "walk" | "ride";

export function classifySport(sport: string | null | undefined): {
  activityType: InternalActivityType;
  allowedModes: string[];
} {
  const s = (sport ?? "").toLowerCase();
  const isRide = s.includes("ride") || s.includes("cycling");
  const isWalk = s.includes("walk") || s.includes("hike");
  const activityType: InternalActivityType = isRide ? "ride" : isWalk ? "walk" : "run";
  const allowedModes = isRide
    ? ["Ride", "ride", "any"]
    : ["Run", "Walk", "run", "walk", "any"];
  return { activityType, allowedModes };
}
