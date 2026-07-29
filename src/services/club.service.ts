import { supabase } from "@/integrations/supabase/client";
import type { Club, MyClub } from "@/types/club";
import type { UserClubInput } from "@/schemas/club.schema";
import { slugify } from "@/schemas/club.schema";
import { toServiceError } from "./errors";

// Full-row columns — used only for owner/admin reads via the base table.
const CLUB_COLS =
  "id, slug, name, club_type, description, logo_url, banner_url, promoter_id, promoter_name, promoter_email, promoter_phone, promoter_address, promoter_city, promoter_state, promoter_dob, promoter_description, established_at, registration_code, referral_code, discount_challenge_percent, discount_cart_percent, social_links, tags, is_public, status, priority, member_count, created_by, created_at, updated_at";

const normalizeClub = (row: any): Club => ({
  ...row,
  social_links: Array.isArray(row.social_links) ? row.social_links : [],
  tags: Array.isArray(row.tags) ? row.tags : [],
});

// Public reads go through SECURITY DEFINER RPCs that return only safe
// columns (no promoter email/phone/address/DOB). Anonymous and signed-in
// users can call them; owners/admins still see full details via base table.
export const listClubs = async (): Promise<Club[]> => {
  const { data, error } = await supabase.rpc("list_public_clubs" as never);
  if (error) throw toServiceError(error, "Could not load clubs");
  return ((data as any[]) ?? []).map(normalizeClub);
};

export const getClubBySlug = async (slug: string): Promise<Club | null> => {
  const { data, error } = await supabase.rpc(
    "get_public_club_by_slug" as never,
    { _slug: slug } as never,
  );
  if (error) throw toServiceError(error, "Could not load club");
  const row = Array.isArray(data) ? (data as any[])[0] : data;
  return row ? normalizeClub(row) : null;
};

export type ClubMemberView = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  is_owner: boolean;
  activities_count: number;
  total_distance_km: number;
  challenges_completed: number;
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
};

export const listClubMembers = async (
  clubId: string,
): Promise<ClubMemberView[]> => {
  const { data, error } = await supabase.rpc("list_club_members" as never, {
    _club_id: clubId,
  } as never);
  if (error) throw toServiceError(error, "Could not load club members");
  return ((data as any[]) ?? []).map((r: any) => ({
    id: r.membership_id,
    user_id: r.user_id,
    role: r.role,
    joined_at: r.joined_at,
    is_owner: !!r.is_owner,
    activities_count: Number(r.activities_count ?? 0),
    total_distance_km: Number(r.total_distance_km ?? 0),
    challenges_completed: Number(r.challenges_completed ?? 0),
    profile: {
      id: r.user_id,
      full_name: r.full_name ?? null,
      avatar_url: r.avatar_url ?? null,
      city: r.city ?? null,
    },
  }));
};

export const uploadClubBanner = async (
  userId: string,
  file: File,
): Promise<string> => {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("club-banners")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw toServiceError(upErr, "Could not upload banner");
  const { data: pub } = supabase.storage.from("club-banners").getPublicUrl(path);
  return pub.publicUrl;
};

export const createClub = async (
  input: UserClubInput,
  userId: string,
): Promise<Club> => {
  // Generate a unique slug
  let base = slugify(input.name) || "club";
  let slug = base;
  for (let i = 2; i < 60; i++) {
    const { data: ex } = await supabase
      .from("clubs")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!ex) break;
    slug = `${base}-${i}`;
  }

  const payload = {
    ...input,
    slug,
    created_by: userId,
    promoter_id: userId,
    // Trigger enforces pending + private + priority=0 for non-admins regardless.
    status: "pending" as const,
    is_public: false,
  };

  const { data, error } = await supabase
    .from("clubs")
    .insert(payload as any)
    .select(CLUB_COLS)
    .single();
  if (error) throw toServiceError(error, "Could not create club");

  // Auto-join the creator as owner. RLS allows this because
  // clubs.created_by = auth.uid().
  const club = normalizeClub(data);
  const { error: memErr } = await supabase
    .from("club_members")
    .insert({ club_id: club.id, user_id: userId, role: "owner" });
  if (memErr && (memErr as any).code !== "23505") {
    // Don't fail the whole flow — club already exists.
    console.warn("[createClub] could not auto-join creator", memErr);
  }
  return club;
};

export class AlreadyMemberError extends Error {
  code = "ALREADY_MEMBER";
  constructor() {
    super("You are already a member of this club.");
  }
}

export const isMemberOfClub = async (
  clubId: string,
  userId: string,
): Promise<boolean> => {
  const { data, error } = await supabase
    .from("club_members")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw toServiceError(error, "Could not check membership");
  return !!data;
};

export const joinClub = async (clubId: string, userId: string): Promise<void> => {
  const existing = await isMemberOfClub(clubId, userId);
  if (existing) throw new AlreadyMemberError();
  const { error } = await supabase
    .from("club_members")
    .insert({ club_id: clubId, user_id: userId, role: "member" });
  if (error) {
    if ((error as any).code === "23505") throw new AlreadyMemberError();
    throw toServiceError(error, "Could not join club");
  }
};

export const leaveClub = async (clubId: string, userId: string): Promise<void> => {
  const { error } = await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not leave club");
};

export const listMyClubs = async (userId: string): Promise<MyClub[]> => {
  const { data, error } = await supabase
    .from("club_members")
    .select(
      "id, club_id, joined_at, club:clubs!club_members_club_id_fkey(id, slug, name, logo_url, banner_url, status, is_public, member_count)",
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  if (error) throw toServiceError(error, "Could not load your clubs");
  return (data ?? []).filter((r: any) => r.club) as MyClub[];
};

export const listMyClubMemberships = async (
  userId: string,
): Promise<string[]> => {
  const { data, error } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not load memberships");
  return (data ?? []).map((r: any) => r.club_id);
};
