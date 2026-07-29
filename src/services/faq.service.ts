import { supabase } from "@/integrations/supabase/client";
import type {
  Faq,
  FaqFormData,
  FaqListParams,
  FaqListResult,
} from "@/types/faq";

const TABLE = "faqs" as const;

function mapError(error: { message: string }): Error {
  return new Error(error.message);
}

function normalize(input: FaqFormData): FaqFormData {
  return {
    question: input.question.trim(),
    answer: input.answer,
    status: input.status,
    sort_order: input.sort_order ?? 0,
  };
}

export const faqService = {
  async listPublicEnabled(): Promise<Faq[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("status", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw mapError(error);
    return (data ?? []) as unknown as Faq[];
  },

  async listAdmin(params: FaqListParams = {}): Promise<FaqListResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(TABLE)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const search = params.search?.trim();
    if (search) {
      query = query.ilike("question", `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw mapError(error);
    return {
      rows: (data ?? []) as unknown as Faq[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  async getById(id: string): Promise<Faq> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw mapError(error);
    if (!data) throw new Error("FAQ not found");
    return data as unknown as Faq;
  },

  async create(input: FaqFormData): Promise<Faq> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(normalize(input) as never)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Faq;
  },

  async update(id: string, input: FaqFormData): Promise<Faq> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(normalize(input) as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Faq;
  },

  async remove(id: string): Promise<{ id: string }> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw mapError(error);
    return { id };
  },

  async toggleStatus(id: string, next: boolean): Promise<Faq> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: next } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Faq;
  },
};
