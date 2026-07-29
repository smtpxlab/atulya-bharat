import { supabase } from "@/integrations/supabase/client";
import type {
  Testimonial,
  TestimonialFormData,
  TestimonialListParams,
  TestimonialListResult,
} from "@/types/testimonial";

const TABLE = "testimonials" as const;
const BUCKET = "challenge-assets";

function mapError(error: { message: string }): Error {
  return new Error(error.message);
}

function normalize(input: TestimonialFormData): TestimonialFormData {
  return {
    author_name: input.author_name.trim(),
    image_url: input.image_url?.trim() ? input.image_url.trim() : null,
    description: input.description,
    sort_order: input.sort_order ?? 0,
  };
}

export const testimonialService = {
  async listPublic(): Promise<Testimonial[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw mapError(error);
    return (data ?? []) as unknown as Testimonial[];
  },

  async listAdmin(params: TestimonialListParams = {}): Promise<TestimonialListResult> {
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
      query = query.ilike("author_name", `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw mapError(error);
    return {
      rows: (data ?? []) as unknown as Testimonial[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  async getById(id: string): Promise<Testimonial> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw mapError(error);
    if (!data) throw new Error("Testimonial not found");
    return data as unknown as Testimonial;
  },

  async create(input: TestimonialFormData): Promise<Testimonial> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(normalize(input) as never)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Testimonial;
  },

  async update(id: string, input: TestimonialFormData): Promise<Testimonial> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(normalize(input) as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Testimonial;
  },

  async remove(id: string): Promise<{ id: string }> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw mapError(error);
    return { id };
  },

  async uploadImage(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed");
    }
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `testimonials/${id}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },
};
