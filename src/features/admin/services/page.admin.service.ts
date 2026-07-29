import { supabase } from "@/integrations/supabase/client";
import type { AdminPageInput, AdminPageUpdate } from "@/schemas/page.schema";
import type { Page, PageDetail, PageStatus } from "@/types/page";

export type AdminPageListParams = {
  q?: string;
  status?: "all" | PageStatus;
  page?: number;
  pageSize?: number;
};

export type AdminPageList = {
  items: Page[];
  page: number;
  pageSize: number;
  total: number;
};

const LIST_SELECT =
  "id,title,slug,status,created_by,created_at,updated_at";
const DETAIL_SELECT =
  "id,title,slug,content,status,created_by,created_at,updated_at";

export const adminPagesService = {
  async list(params: AdminPageListParams = {}): Promise<AdminPageList> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("pages")
      .select(LIST_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }
    if (params.q) {
      const q = params.q.trim();
      if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return {
      items: (data ?? []) as unknown as Page[],
      page,
      pageSize,
      total: count ?? 0,
    };
  },

  async get(id: string): Promise<PageDetail> {
    const { data, error } = await supabase
      .from("pages")
      .select(DETAIL_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Page not found");
    return data as unknown as PageDetail;
  },

  async create(input: AdminPageInput): Promise<PageDetail> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const row = { ...input, created_by: user?.id ?? null };
    const { data, error } = await supabase
      .from("pages")
      .insert(row as never)
      .select(DETAIL_SELECT)
      .single();
    if (error) throw friendlyError(error);
    return data as unknown as PageDetail;
  },

  async update(id: string, input: AdminPageUpdate): Promise<PageDetail> {
    const { data, error } = await supabase
      .from("pages")
      .update(input as never)
      .eq("id", id)
      .select(DETAIL_SELECT)
      .single();
    if (error) throw friendlyError(error);
    return data as unknown as PageDetail;
  },

  async remove(id: string): Promise<{ id: string }> {
    const { error } = await supabase.from("pages").delete().eq("id", id);
    if (error) throw error;
    return { id };
  },
};

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return new Error("A page with this slug already exists.");
  }
  return new Error(error.message);
}
