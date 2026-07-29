import { supabase } from "@/integrations/supabase/client";
import {
  challengeFromRow,
  ticketFromRow,
  type Challenge,
  type ChallengeDetail,
  type ChallengeListItem,
  type ChallengeTicket,
} from "@/types/challenge";
import { toServiceError } from "./errors";
import type { ChallengeFormValues } from "@/features/challenges/schemas/challenge.schema";

const CHALLENGE_PUBLIC_COLUMNS =
  "id, slug, name, challenge_type, category, tags, cover_image_url, about_map_image_url, creative_image_url, certificate_image_url, bib_image_url, route_map_image_url, distance, max_duration_days, start_at, end_at, description, status, created_by, created_at, updated_at";

const TICKET_COLUMNS =
  "id, challenge_id, ticket_name, ticket_price, ticket_inclusions, shipping_cost, allow_certificate";

// ---------- Public ----------

export const listChallenges = async (): Promise<ChallengeListItem[]> => {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("challenges")
    .select(`${CHALLENGE_PUBLIC_COLUMNS}, challenge_tickets(ticket_price)`)
    .eq("status", true)
    .or(`end_at.is.null,end_at.gte.${nowIso}`)
    .order("created_at", { ascending: false });


  if (error) throw toServiceError(error, "Could not load challenges");

  return (data ?? []).map((r: any) => {
    const prices: number[] = (r.challenge_tickets ?? []).map(
      (t: any) => Number(t.ticket_price ?? 0),
    );
    return {
      ...challengeFromRow(r),
      min_price: prices.length ? Math.min(...prices) : null,
    };
  });
};

export const getChallengeDetails = async (
  slug: string,
): Promise<ChallengeDetail | null> => {
  const { data: ch, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("slug", slug)
    .eq("status", true)
    .maybeSingle();

  if (error) throw toServiceError(error, "Could not load challenge", { slug });
  if (!ch) return null;

  const challenge = challengeFromRow(ch);

  const { data: ticketsData, error: tErr } = await supabase
    .from("challenge_tickets")
    .select(TICKET_COLUMNS)
    .eq("challenge_id", challenge.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (tErr) throw toServiceError(tErr, "Could not load tickets");

  return {
    challenge,
    tickets: (ticketsData ?? []).map(ticketFromRow),
  };
};

// ---------- Admin ----------

export type AdminChallengeListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
  status?: "all" | "active" | "inactive";
};

export type AdminChallengeListResult = {
  items: ChallengeListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export const listAdminChallenges = async (
  params: AdminChallengeListParams = {},
): Promise<AdminChallengeListResult> => {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("challenges")
    .select(`${CHALLENGE_PUBLIC_COLUMNS}, challenge_tickets(ticket_price)`, {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (params.search?.trim()) q = q.ilike("name", `%${params.search.trim()}%`);
  if (params.status === "active") q = q.eq("status", true);
  if (params.status === "inactive") q = q.eq("status", false);

  const { data, error, count } = await q.range(from, to);
  if (error) throw toServiceError(error, "Could not load challenges");

  const items = (data ?? []).map((r: any) => {
    const prices: number[] = (r.challenge_tickets ?? []).map(
      (t: any) => Number(t.ticket_price ?? 0),
    );
    return {
      ...challengeFromRow(r),
      min_price: prices.length ? Math.min(...prices) : null,
    };
  });

  return { items, total: count ?? items.length, page, pageSize };
};

export const getAdminChallengeById = async (
  id: string,
): Promise<{ challenge: Challenge; tickets: ChallengeTicket[] } | null> => {
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw toServiceError(error, "Could not load challenge");
  if (!data) return null;

  const { data: tickets, error: tErr } = await supabase
    .from("challenge_tickets")
    .select(TICKET_COLUMNS)
    .eq("challenge_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (tErr) throw toServiceError(tErr, "Could not load tickets");

  return {
    challenge: challengeFromRow(data),
    tickets: (tickets ?? []).map(ticketFromRow),
  };
};

const toChallengeRow = (v: ChallengeFormValues, createdBy?: string | null) => ({
  name: v.name.trim(),
  slug: v.slug.trim(),
  challenge_type: v.challenge_type,
  category: v.category,
  tags: v.tags ?? [],
  cover_image_url: v.cover_image_url || null,
  about_map_image_url: v.about_map_image_url || null,
  creative_image_url: v.creative_image_url || null,
  certificate_image_url: v.certificate_image_url || null,
  bib_image_url: v.bib_image_url || null,
  route_map_image_url: v.route_map_image_url || null,
  distance: v.distance,
  max_duration_days: v.max_duration_days ?? null,
  start_at: v.start_at || null,
  end_at: v.end_at || null,
  description: v.description || null,
  status: v.status,
  meta_title: v.meta_title?.trim() || null,
  meta_description: v.meta_description?.trim() || null,
  meta_keywords: v.meta_keywords ?? [],
  ...(createdBy ? { created_by: createdBy } : {}),
});

const toTicketRows = (challengeId: string, tickets: ChallengeFormValues["tickets"]) =>
  tickets.map((t, i) => ({
    challenge_id: challengeId,
    ticket_name: t.ticket_name.trim(),
    ticket_price: t.ticket_price,
    ticket_inclusions: t.ticket_inclusions,
    shipping_cost: t.shipping_cost,
    allow_certificate: t.allow_certificate,
    sort_order: i,
  }));

export const createChallenge = async (
  payload: ChallengeFormValues,
): Promise<Challenge> => {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id ?? null;

  const { data: inserted, error } = await supabase
    .from("challenges")
    .insert(toChallengeRow(payload, userId))
    .select("*")
    .single();

  if (error) throw toServiceError(error, "Could not create challenge");

  const ticketRows = toTicketRows(inserted.id, payload.tickets);
  const { error: tErr } = await supabase.from("challenge_tickets").insert(ticketRows);
  if (tErr) {
    // manual rollback — PostgREST has no multi-statement transactions
    await supabase.from("challenges").delete().eq("id", inserted.id);
    throw toServiceError(tErr, "Could not save tickets");
  }

  return challengeFromRow(inserted);
};

export const updateChallenge = async (
  id: string,
  payload: ChallengeFormValues,
): Promise<Challenge> => {
  const { data: updated, error } = await supabase
    .from("challenges")
    .update(toChallengeRow(payload))
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw toServiceError(error, "Could not update challenge");

  const { error: delErr } = await supabase
    .from("challenge_tickets")
    .delete()
    .eq("challenge_id", id);
  if (delErr) throw toServiceError(delErr, "Could not refresh tickets");

  const ticketRows = toTicketRows(id, payload.tickets);
  const { error: insErr } = await supabase.from("challenge_tickets").insert(ticketRows);
  if (insErr) throw toServiceError(insErr, "Could not save tickets");

  return challengeFromRow(updated);
};

export const deleteChallenge = async (id: string): Promise<void> => {
  const { error } = await supabase.from("challenges").delete().eq("id", id);
  if (error) throw toServiceError(error, "Could not delete challenge");
};

export const toggleChallengeStatus = async (
  id: string,
  status: boolean,
): Promise<void> => {
  const { error } = await supabase
    .from("challenges")
    .update({ status })
    .eq("id", id);
  if (error) throw toServiceError(error, "Could not update status");
};

export const CHALLENGE_IMAGE_FOLDERS = [
  "cover",
  "about-map",
  "creative",
  "certificate",
  "bib",
  "route-map",
] as const;
export type ChallengeImageFolder = (typeof CHALLENGE_IMAGE_FOLDERS)[number];

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export const uploadChallengeImage = async (
  file: File,
  folder: ChallengeImageFolder,
): Promise<string> => {
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error("Only JPG, PNG, or WEBP images are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("challenge-assets")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });

  if (error) throw toServiceError(error, "Image upload failed");

  const { data } = supabase.storage.from("challenge-assets").getPublicUrl(path);
  return data.publicUrl;
};
