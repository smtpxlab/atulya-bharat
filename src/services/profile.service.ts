import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types/profile";
import {
  profileUpdateSchema,
  type ProfileUpdateInput,
} from "@/features/profile/profile.schema";
import { toServiceError, ServiceError } from "./errors";

export const getProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw toServiceError(error, "Could not load profile");
  return (data as Profile) ?? null;
};

export const updateProfile = async (
  userId: string,
  input: ProfileUpdateInput,
): Promise<Profile> => {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw toServiceError(
      parsed.error,
      parsed.error.issues[0]?.message ?? "Invalid profile",
    );
  }
  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw toServiceError(error, "Could not update profile");
  return data as Profile;
};

export const changePassword = async (
  email: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: oldPassword,
  });
  if (signInError) {
    throw new ServiceError("Old password is incorrect.", { cause: signInError, code: "invalid_old_password" });
  }
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) throw toServiceError(updateError, "Could not update password");
};

const PROFILE_BUCKET = "profile-images";
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Extract the storage object path from a public URL for this bucket. */
const pathFromPublicUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${PROFILE_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split("?")[0];
};

export const uploadProfileImage = async (
  userId: string,
  blob: Blob,
  previousUrl?: string | null,
): Promise<string> => {
  if (blob.size > MAX_BYTES) {
    throw new ServiceError("Image must be 5 MB or smaller.", { code: "file_too_large" });
  }
  const contentType = blob.type || "image/webp";
  const path = `${userId}/${Date.now()}.webp`;

  const { error: upErr } = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(path, blob, { contentType, upsert: false, cacheControl: "3600" });
  if (upErr) throw toServiceError(upErr, "Could not upload profile photo");

  const { data: pub } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);
  if (updErr) throw toServiceError(updErr, "Could not save profile photo");

  // Best-effort cleanup of previous image (don't fail the flow).
  const prevPath = pathFromPublicUrl(previousUrl);
  if (prevPath && prevPath !== path) {
    await supabase.storage.from(PROFILE_BUCKET).remove([prevPath]).catch(() => {});
  }

  return publicUrl;
};

export const removeProfileImage = async (
  userId: string,
  previousUrl?: string | null,
): Promise<void> => {
  const { error: updErr } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", userId);
  if (updErr) throw toServiceError(updErr, "Could not remove profile photo");

  const prevPath = pathFromPublicUrl(previousUrl);
  if (prevPath) {
    await supabase.storage.from(PROFILE_BUCKET).remove([prevPath]).catch(() => {});
  }
};

export const profileImageConstraints = {
  ALLOWED_MIME,
  MAX_BYTES,
};

export type DashboardClubRow = {
  id: string;
  slug: string;
  name: string;
  promoter_name: string | null;
  status: string;
  membership_id?: string;
};

export const getCreatedClubs = async (
  userId: string,
): Promise<DashboardClubRow[]> => {
  // Owner-only read; RLS allows full row but we only select safe fields.
  const { data, error } = await supabase
    .from("clubs")
    .select("id, slug, name, promoter_name, status")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw toServiceError(error, "Could not load your clubs");
  return (data ?? []) as DashboardClubRow[];
};

export const getJoinedClubs = async (
  userId: string,
): Promise<DashboardClubRow[]> => {
  // Members only see safe club fields — no promoter PII.
  const { data, error } = await supabase
    .from("club_members")
    .select(
      "id, club:clubs!club_members_club_id_fkey (id, slug, name, promoter_name, status)",
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw toServiceError(error, "Could not load joined clubs");
  return ((data ?? []) as any[])
    .filter((r) => r.club)
    .map((r) => ({ ...r.club, membership_id: r.id })) as DashboardClubRow[];
};
