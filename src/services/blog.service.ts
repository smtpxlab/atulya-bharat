import { supabase } from "@/integrations/supabase/client";
import type { BlogPost } from "@/types/blog";
import { toServiceError } from "./errors";

const SELECT =
  "id,slug,title,excerpt,content_md,content_html,cover_image_url,author,author_id,tags,status,is_published,published_at,meta_title,meta_description,meta_keywords,created_at,updated_at";

export const listPublishedBlogs = async (tag?: string): Promise<BlogPost[]> => {
  let q = supabase
    .from("blog_posts")
    .select(SELECT)
    .eq("is_published", true)
    .order("published_at", { ascending: false });
  if (tag) q = q.contains("tags", [tag]);
  const { data, error } = await q;
  if (error) throw toServiceError(error, "Could not load posts");
  return (data ?? []) as unknown as BlogPost[];
};

export const getPublishedBlogBySlug = async (
  slug: string,
): Promise<BlogPost | null> => {
  const { data, error } = await supabase
    .from("blog_posts")
    .select(SELECT)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw toServiceError(error, "Could not load post");
  return (data as unknown as BlogPost) ?? null;
};

export const listTags = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("tags")
    .eq("is_published", true);
  if (error) throw toServiceError(error, "Could not load tags");
  const set = new Set<string>();
  (data ?? []).forEach((row: any) => (row.tags ?? []).forEach((t: string) => set.add(t)));
  return Array.from(set).sort();
};

// Back-compat aliases
export const listPosts = listPublishedBlogs;
export const getPostBySlug = getPublishedBlogBySlug;
