import { supabase } from "@/integrations/supabase/client";

export type ChallengeProgress = {
  registration_id: string;
  challenge_id: string;
  user_id: string;
  distance_target_km: number;
  distance_logged_km: number;
  distance_remaining_km: number;
  pct_complete: number;
  activities_count: number;
  milestones_total: number;
  milestones_unlocked: number;
  is_complete: boolean;
  window_start: string | null;
  window_end: string | null;
  registered_at: string | null;
  activity_mode: string;
  first_activity_date: string | null;
  last_activity_date: string | null;
  days_left: number;
};

export type ActiveRegistration = {
  registration_id: string;
  challenge_id: string;
  challenge_name: string;
  challenge_slug: string;
  distance_target_km: number;
  activity_mode: string;
  registered_at: string | null;
  window_end: string | null;
  total_km_logged: number;
  cover_image_url: string | null;
};

/** Returns the user's single active registration (or null). Auto-expires stale rows. */
export async function getActiveRegistration(
  userId: string,
): Promise<ActiveRegistration | null> {
  const { data, error } = await supabase.rpc("active_registration" as any, { _user_id: userId });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    registration_id: row.registration_id,
    challenge_id: row.challenge_id,
    challenge_name: row.challenge_name ?? "",
    challenge_slug: row.challenge_slug ?? "",
    distance_target_km: Number(row.distance_target_km ?? 0),
    activity_mode: row.activity_mode ?? "any",
    registered_at: row.registered_at ?? null,
    window_end: row.window_end ?? null,
    total_km_logged: Number(row.total_km_logged ?? 0),
    cover_image_url: row.cover_image_url ?? null,
  };
}

/**
 * Source of truth for challenge progress, scoped to a single registration:
 * counts only activities recorded between registration and window end,
 * filtered by the registration's activity_mode.
 */
export async function getProgressByRegistration(
  registrationId: string,
): Promise<ChallengeProgress | null> {
  const { data, error } = await supabase.rpc("challenge_progress_by_registration" as any, {
    _registration_id: registrationId,
  });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    registration_id: row.registration_id,
    challenge_id: row.challenge_id,
    user_id: row.user_id,
    distance_target_km: Number(row.distance_target_km ?? 0),
    distance_logged_km: Number(row.distance_logged_km ?? 0),
    distance_remaining_km: Number(row.distance_remaining_km ?? 0),
    pct_complete: Number(row.pct_complete ?? 0),
    activities_count: Number(row.activities_count ?? 0),
    milestones_total: Number(row.milestones_total ?? 0),
    milestones_unlocked: Number(row.milestones_unlocked ?? 0),
    is_complete: Boolean(row.is_complete),
    window_start: row.window_start ?? null,
    window_end: row.window_end ?? null,
    registered_at: row.registered_at ?? null,
    activity_mode: row.activity_mode ?? "any",
    first_activity_date: row.first_activity_date ?? null,
    last_activity_date: row.last_activity_date ?? null,
    days_left: Number(row.days_left ?? 0),
  };
}

/**
 * Legacy wrapper kept for callers that still pass (userId, challengeId).
 * Resolves to the most recent registration for that pair, active or not.
 */
export async function getChallengeProgress(
  userId: string,
  challengeId: string,
): Promise<ChallengeProgress | null> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("id")
    .eq("user_id", userId)
    .eq("challenge_id", challengeId)
    .order("registered_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!reg?.id) return null;
  return getProgressByRegistration(reg.id);
}

/** Cancel the user's currently active registration. Returns true on success. */
export async function cancelActiveRegistration(): Promise<
  { ok: true; registration_id: string } | { ok: false; error: string }
> {
  const { data, error } = await supabase.rpc("cancel_active_registration" as any);
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as
    | { ok: boolean; registration_id?: string; error?: string }
    | null;
  if (!row?.ok) return { ok: false, error: row?.error ?? "cancel_failed" };
  return { ok: true, registration_id: row.registration_id! };
}
