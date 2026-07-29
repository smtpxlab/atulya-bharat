import { supabase } from "@/integrations/supabase/client";
import {
  getProgressByRegistration,
  type ChallengeProgress,
} from "@/services/challenge-progress.service";

export type RegistrationChallenge = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  distance: number;
  challenge_type: string | null;
  cover_image_url: string | null;
  creative_image_url: string | null;
  certificate_image_url: string | null;
  bib_image_url: string | null;
  route_map_image_url: string | null;
  max_duration_days: number | null;
  start_at: string | null;
  end_at: string | null;
  bib_overlay_config: unknown;
};

export type RegistrationRow = {
  id: string;
  user_id: string;
  challenge_id: string;
  status: string;
  registered_at: string;
  activity_mode: string | null;
  total_km_logged: number;
  target_days: number | null;
  participation_photo_url: string | null;
  bib_number: string | null;
  certificate_number: string | null;
};

export type MilestoneRow = {
  id: string;
  challenge_id: string;
  spot_name: string;
  distance: number;
  description: string | null;
  spot_image_url: string | null;
  audio_url: string | null;
  sort_order: number | null;
  unlocked_at: string | null;
  postcard_url: string | null;
  x_percent: number | null;
  y_percent: number | null;
};

export type ActivityRow = {
  id: string;
  activity_date: string;
  distance_km: number;
  moving_time_seconds: number | null;
  sport_type: string | null;
  activity_type: string | null;
  source: string;
  start_date: string | null;
  name: string | null;
};

export type RegistrationProfile = {
  full_name: string | null;
  avatar_url: string | null;
};

export type RegistrationDetail = {
  registration: RegistrationRow;
  challenge: RegistrationChallenge;
  progress: ChallengeProgress | null;
  milestones: MilestoneRow[];
  activities: ActivityRow[];
  profile: RegistrationProfile | null;
};

export async function getRegistrationDetail(
  registrationId: string,
  userId: string,
): Promise<RegistrationDetail | null> {
  const { data: reg } = await supabase
    .from("registrations")
    .select(
      "id, user_id, challenge_id, status, registered_at, activity_mode, total_km_logged, target_days, participation_photo_url, bib_number, certificate_number",
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || reg.user_id !== userId) return null;

  const [challengeRes, progress, milestonesRes, unlocksRes, activitiesRes, profileRes] =
    await Promise.all([
      supabase
        .from("challenges")
        .select(
          "id, slug, name, description, distance, challenge_type, cover_image_url, creative_image_url, certificate_image_url, bib_image_url, route_map_image_url, max_duration_days, start_at, end_at, bib_overlay_config",
        )
        .eq("id", reg.challenge_id)
        .maybeSingle(),
      getProgressByRegistration(registrationId),
      supabase
        .from("challenge_milestones")
        .select("id, challenge_id, spot_name, distance, description, spot_image_url, audio_url, sort_order, x_percent, y_percent")
        .eq("challenge_id", reg.challenge_id)
        .order("distance", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("user_milestones")
        .select("milestone_id, unlocked_at")
        .eq("user_id", userId),
      supabase
        .from("activity_logs")
        .select(
          "id, activity_date, distance_km, moving_time_seconds, sport_type, activity_type, source, start_date, raw_payload",
        )
        .eq("registration_id", registrationId)
        .order("activity_date", { ascending: false })
        .order("start_date", { ascending: false }),
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  if (!challengeRes.data) return null;

  const unlockedAt = new Map<string, string>();
  for (const u of (unlocksRes.data ?? []) as any[]) {
    unlockedAt.set(u.milestone_id, u.unlocked_at);
  }

  const milestones: MilestoneRow[] = ((milestonesRes.data ?? []) as any[]).map((m) => ({
    id: m.id,
    challenge_id: m.challenge_id,
    spot_name: m.spot_name ?? "",
    distance: Number(m.distance ?? 0),
    description: m.description ?? null,
    spot_image_url: m.spot_image_url ?? null,
    audio_url: m.audio_url ?? null,
    sort_order: m.sort_order ?? null,
    unlocked_at: unlockedAt.get(m.id) ?? null,
    // Postcard defaults to the milestone's primary image since `media_type` enum
    // does not yet include a dedicated `postcard` variant.
    postcard_url: m.spot_image_url ?? null,
    x_percent: m.x_percent != null ? Number(m.x_percent) : null,
    y_percent: m.y_percent != null ? Number(m.y_percent) : null,
  }));

  const activities: ActivityRow[] = ((activitiesRes.data ?? []) as any[]).map((a) => ({
    id: a.id,
    activity_date: a.activity_date,
    distance_km: Number(a.distance_km ?? 0),
    moving_time_seconds: a.moving_time_seconds ?? null,
    sport_type: a.sport_type ?? null,
    activity_type: a.activity_type ?? null,
    source: a.source ?? "manual",
    start_date: a.start_date ?? null,
    name: a.raw_payload?.name ?? null,
  }));

  return {
    registration: reg as RegistrationRow,
    challenge: challengeRes.data as RegistrationChallenge,
    progress,
    milestones,
    activities,
    profile: profileRes.data ?? null,
  };
}
