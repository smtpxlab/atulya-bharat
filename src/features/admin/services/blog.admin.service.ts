import { supabase } from "@/integrations/supabase/client";
import type { AdminBlogInput, AdminBlogUpdate } from "@/schemas/blog.schema";
import type { BlogPost, BlogStatus } from "@/types/blog";

export type AdminBlogListParams = {
  q?: string;
  status?: "all" | BlogStatus;
  page?: number;
  pageSize?: number;
};

export type AdminBlogList = {
  items: BlogPost[];
  page: number;
  pageSize: number;
  total: number;
};

const SELECT =
  "id,slug,title,excerpt,content_md,content_html,cover_image_url,author,author_id,tags,status,is_published,published_at,meta_title,meta_description,meta_keywords,created_at,updated_at";

export const adminBlogsService = {
  async list(params: AdminBlogListParams = {}): Promise<AdminBlogList> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("blog_posts")
      .select(SELECT, { count: "exact" })
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
      items: (data ?? []) as unknown as BlogPost[],
      page,
      pageSize,
      total: count ?? 0,
    };
  },

  async get(id: string): Promise<BlogPost> {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Blog post not found");
    return data as unknown as BlogPost;
  },

  async create(input: AdminBlogInput): Promise<BlogPost> {
    const { data: { user } } = await supabase.auth.getUser();
    const row = {
      ...input,
      author_id: user?.id ?? null,
      published_at: input.status === "published" ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase
      .from("blog_posts")
      .insert(row as any)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as BlogPost;
  },

  async update(id: string, input: AdminBlogUpdate): Promise<BlogPost> {
    // Set published_at on first publish if not set
    const row: Record<string, unknown> = { ...input };
    if (input.status === "published") {
      const current = await this.get(id);
      if (!current.published_at) row.published_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from("blog_posts")
      .update(row as any)
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as unknown as BlogPost;
  },

  async remove(id: string): Promise<{ id: string }> {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;
    return { id };
  },

  async publish(id: string): Promise<BlogPost> {
    return this.update(id, { status: "published" });
  },

  async unpublish(id: string): Promise<BlogPost> {
    return this.update(id, { status: "draft" });
  },

  async uploadCoverImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("blog-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
    return data.publicUrl;
  },
};
