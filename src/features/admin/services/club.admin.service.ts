import { supabase } from "@/integrations/supabase/client";
import type { AdminClubInput, AdminClubUpdate } from "@/schemas/club.schema";

export type AdminClubListParams = {
  q?: string;
  status?: "pending" | "approved" | "rejected" | "all";
  visibility?: "all" | "public" | "hidden";
  page?: number;
  pageSize?: number;
};

export type AdminClub = {
  id: string;
  name: string;
  slug: string;
  club_type: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  promoter_id: string | null;
  promoter_name: string | null;
  promoter_email: string | null;
  promoter_phone: string | null;
  promoter_address: string | null;
  promoter_city: string | null;
  promoter_state: string | null;
  promoter_dob: string | null;
  promoter_description: string | null;
  is_public: boolean;
  status: "pending" | "approved" | "rejected";
  priority: number;
  registration_code: string | null;
  referral_code: string | null;
  discount_challenge_percent: number;
  discount_cart_percent: number;
  established_at: string | null;
  member_count: number;
  social_links: string[];
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[];
  promoter:
    | {
        id: string;
        full_name: string | null;
        avatar_url: string | null;
      }
    | null;
};

export type AdminClubList = {
  items: AdminClub[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminClubMember = {
  id: string;
  role: string;
  joined_at: string;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
  } | null;
};

export type AdminClubReports = {
  counts: { total: number; pending: number; approved: number; rejected: number };
  topByMembers: {
    id: string;
    name: string;
    slug: string;
    status: string;
    member_count: number;
  }[];
};

export type ClubMemberReportRow = {
  clubId: string;
  clubName: string;
  promoterName: string;
  promoterEmail: string;
  promoterPhone: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  memberAddress: string;
  joinedAt: string;
};

const CLUB_COLS =
  "id, name, slug, club_type, description, logo_url, banner_url, promoter_id, promoter_name, promoter_email, promoter_phone, promoter_address, promoter_city, promoter_state, promoter_dob, promoter_description, is_public, status, priority, registration_code, referral_code, discount_challenge_percent, discount_cart_percent, established_at, member_count, social_links, tags, meta_title, meta_description, meta_keywords, created_by, created_at, updated_at";

const CLUB_SELECT = `${CLUB_COLS}, promoter:profiles!clubs_promoter_id_fkey(id, full_name, avatar_url)`;

const normalize = (row: any): AdminClub => ({
  ...row,
  social_links: Array.isArray(row.social_links) ? row.social_links : [],
  tags: Array.isArray(row.tags) ? row.tags : [],
});

export const adminClubsService = {
  async list(params: AdminClubListParams = {}): Promise<AdminClubList> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("clubs")
      .select(CLUB_SELECT, { count: "exact" })
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }
    if (params.visibility && params.visibility !== "all") {
      query = query.eq("is_public", params.visibility === "public");
    }
    if (params.q) {
      const q = params.q.trim();
      if (q) {
        query = query.or(
          `name.ilike.%${q}%,slug.ilike.%${q}%,promoter_name.ilike.%${q}%,promoter_email.ilike.%${q}%`,
        );
      }
    }
    const { data, error, count } = await query;
    if (error) throw error;
    return {
      items: (data ?? []).map(normalize),
      page,
      pageSize,
      total: count ?? 0,
    };
  },

  async get(id: string): Promise<AdminClub> {
    const { data, error } = await supabase
      .from("clubs")
      .select(CLUB_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Club not found");
    return normalize(data);
  },

  async create(input: AdminClubInput): Promise<AdminClub> {
    const { data, error } = await supabase
      .from("clubs")
      .insert(input as any)
      .select("id")
      .single();
    if (error) throw error;
    return this.get(data.id);
  },

  async update(id: string, input: AdminClubUpdate): Promise<AdminClub> {
    if (Object.keys(input).length > 0) {
      const { error } = await supabase
        .from("clubs")
        .update(input as any)
        .eq("id", id);
      if (error) throw error;
    }
    return this.get(id);
  },

  async remove(id: string): Promise<{ id: string }> {
    const { error } = await supabase.from("clubs").delete().eq("id", id);
    if (error) throw error;
    return { id };
  },

  async approve(id: string) {
    return this.update(id, { status: "approved", is_public: true } as any);
  },

  async reject(id: string) {
    return this.update(id, { status: "rejected", is_public: false } as any);
  },

  async toggleVisibility(id: string, is_public: boolean) {
    return this.update(id, { is_public } as any);
  },

  async updatePriority(id: string, priority: number) {
    return this.update(id, { priority } as any);
  },

  async members(id: string): Promise<{ items: AdminClubMember[] }> {
    const { data, error } = await supabase.rpc("list_club_members" as never, {
      _club_id: id,
    } as never);
    if (error) throw error;
    const items: AdminClubMember[] = ((data as any[]) ?? []).map((r: any) => ({
      id: r.membership_id,
      role: r.role,
      joined_at: r.joined_at,
      user: {
        id: r.user_id,
        full_name: r.full_name ?? null,
        avatar_url: r.avatar_url ?? null,
        city: r.city ?? null,
      },
    }));
    return { items };
  },

  async reports(): Promise<AdminClubReports> {
    const headCount = (status?: string) => {
      let q = supabase.from("clubs").select("id", { count: "exact", head: true });
      if (status) q = q.eq("status", status);
      return q;
    };
    const [total, pend, app, rej, top] = await Promise.all([
      headCount(),
      headCount("pending"),
      headCount("approved"),
      headCount("rejected"),
      supabase
        .from("clubs")
        .select("id, name, slug, status, member_count")
        .order("member_count", { ascending: false })
        .limit(10),
    ]);
    if (top.error) throw top.error;
    return {
      counts: {
        total: total.count ?? 0,
        pending: pend.count ?? 0,
        approved: app.count ?? 0,
        rejected: rej.count ?? 0,
      },
      topByMembers: (top.data ?? []) as AdminClubReports["topByMembers"],
    };
  },

  async exportSummary() {
    const { data, error } = await supabase
      .from("clubs")
      .select("name, promoter_name, promoter_email, promoter_phone, member_count")
      .order("priority", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((c: any) => ({
      "Club Name": c.name,
      "Promoter Name": c.promoter_name ?? "",
      "Promoter Email": c.promoter_email ?? "",
      "Promoter Phone": c.promoter_phone ?? "",
      "Total Members": c.member_count ?? 0,
    }));
  },

  async getClubMemberReport(): Promise<ClubMemberReportRow[]> {
    const { data, error } = await supabase
      .from("club_members")
      .select(
        `joined_at,
         club:clubs!club_members_club_id_fkey(id, name, promoter_name, promoter_email, promoter_phone),
         profile:profiles!club_members_user_id_fkey(id, full_name, email, mobile, house_no, address, city, state, pincode)`,
      )
      .order("joined_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any): ClubMemberReportRow => {
      const p = r.profile ?? {};
      const addrParts = [p.house_no, p.address, p.city, p.state, p.pincode].filter(
        (x: unknown) => x != null && String(x).trim() !== "",
      );
      const memberAddress = addrParts.length ? addrParts.join(", ") : "N/A";
      return {
        clubId: r.club?.id ?? "",
        clubName: r.club?.name ?? "N/A",
        promoterName: r.club?.promoter_name ?? "N/A",
        promoterEmail: r.club?.promoter_email ?? "N/A",
        promoterPhone: r.club?.promoter_phone ?? "N/A",
        memberId: p.id ?? "",
        memberName: p.full_name ?? "N/A",
        memberEmail: p.email ?? "N/A",
        memberPhone: p.mobile ?? "N/A",
        memberAddress,
        joinedAt: r.joined_at,
      };
    });
  },

  async exportMembers() {
    const rows = await this.getClubMemberReport();
    return rows.map((r) => ({
      "Club Name": r.clubName,
      "Promoter Name": r.promoterName,
      "Promoter Email": r.promoterEmail,
      "Promoter Phone": r.promoterPhone,
      "Member Name": r.memberName,
      "Member Email": r.memberEmail,
      "Member Phone": r.memberPhone,
      "Member Address": r.memberAddress,
      "Joined Date": r.joinedAt,
    }));
  },
};
