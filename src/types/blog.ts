export type BlogStatus = "draft" | "published";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_md: string | null;
  content_html: string | null;
  cover_image_url: string | null;
  author: string | null;
  author_id: string | null;
  tags: string[];
  status: BlogStatus;
  is_published: boolean;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[];
  created_at: string;
  updated_at: string;
};

export type BlogDetail = BlogPost;
