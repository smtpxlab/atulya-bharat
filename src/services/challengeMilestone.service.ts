import { supabase } from "@/integrations/supabase/client";
import { toServiceError } from "@/services/errors";
import type {
  Milestone,
  MilestoneFormValues,
  MilestoneListItem,
} from "@/types/milestone";

const SELECT_WITH_CHALLENGE =
  "*, challenge:challenges!milestones_challenge_id_fkey(id,name)";

export type ListMilestonesParams = {
  q?: string;
  challengeId?: string;
  page?: number;
  pageSize?: number;
};

export type ListMilestonesResult = {
  items: MilestoneListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listMilestones(
  params: ListMilestonesParams = {},
): Promise<ListMilestonesResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Resolve challenge name search via a prefetch (PostgREST doesn't support OR
  // across embedded relations cleanly).
  let challengeIdFilter: string[] | null = null;
  const q = params.q?.trim();
  if (q) {
    const { data: matched, error: cErr } = await supabase
      .from("challenges")
      .select("id")
      .ilike("name", `%${q}%`);
    if (cErr) throw toServiceError(cErr, "Search failed");
    challengeIdFilter = (matched ?? []).map((c) => c.id);
  }

  let query = supabase
    .from("challenge_milestones")
    .select(SELECT_WITH_CHALLENGE, { count: "exact" })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .range(from, to);

  if (params.challengeId) {
    query = query.eq("challenge_id", params.challengeId);
  }

  if (q) {
    const ids = challengeIdFilter ?? [];
    const orParts = [`spot_name.ilike.%${q}%`];
    if (ids.length) {
      orParts.push(`challenge_id.in.(${ids.join(",")})`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw toServiceError(error, "Could not load milestones");

  return {
    items: (data ?? []) as unknown as MilestoneListItem[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getMilestoneById(id: string): Promise<MilestoneListItem> {
  const { data, error } = await supabase
    .from("challenge_milestones")
    .select(SELECT_WITH_CHALLENGE)
    .eq("id", id)
    .maybeSingle();
  if (error) throw toServiceError(error, "Could not load milestone");
  if (!data) throw new Error("Milestone not found");
  return data as unknown as MilestoneListItem;
}

export async function createMilestone(
  input: MilestoneFormValues,
): Promise<Milestone> {
  const { data: last, error: maxErr } = await supabase
    .from("challenge_milestones")
    .select("sort_order")
    .eq("challenge_id", input.challenge_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxErr) throw toServiceError(maxErr, "Could not determine milestone order");
  const nextSortOrder = (last?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("challenge_milestones")
    .insert({ ...input, sort_order: nextSortOrder })
    .select("*")
    .single();
  if (error) throw toServiceError(error, "Could not create milestone");
  return data as Milestone;
}

export async function updateMilestone(
  id: string,
  input: Partial<MilestoneFormValues>,
): Promise<Milestone> {
  const { data, error } = await supabase
    .from("challenge_milestones")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toServiceError(error, "Could not update milestone");
  return data as Milestone;
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase
    .from("challenge_milestones")
    .delete()
    .eq("id", id);
  if (error) throw toServiceError(error, "Could not delete milestone");
}

export async function toggleMilestoneStatus(
  id: string,
  status: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("challenge_milestones")
    .update({ status })
    .eq("id", id);
  if (error) throw toServiceError(error, "Could not update status");
}

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_AUDIO_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export async function uploadMilestoneImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
    throw new Error("Only JPG, PNG, or WEBP images are allowed.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `milestones/images/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("challenge-assets")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw toServiceError(error, "Image upload failed");
  const { data } = supabase.storage.from("challenge-assets").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadMilestoneAudio(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
  const isExtOk = ["mp3", "wav", "m4a"].includes(ext);
  if (!isExtOk && !ALLOWED_AUDIO_MIME.includes(file.type)) {
    throw new Error("Only MP3, WAV, or M4A audio files are allowed.");
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error("Audio must be 20 MB or smaller.");
  }
  const path = `milestones/audio/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("challenge-assets")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
  if (error) throw toServiceError(error, "Audio upload failed");
  const { data } = supabase.storage.from("challenge-assets").getPublicUrl(path);
  return data.publicUrl;
}
