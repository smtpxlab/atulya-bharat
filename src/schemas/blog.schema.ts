import { z } from "zod";

export const blogFiltersSchema = z.object({
  tag: z.string().trim().max(60).optional(),
});
export type BlogFilters = z.infer<typeof blogFiltersSchema>;

const nullableUrl = z
  .string()
  .url("Must be a valid URL")
  .optional()
  .or(z.literal("").transform(() => null))
  .nullable();

export const adminBlogInputSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  excerpt: z.string().max(500).optional().nullable(),
  content_html: z.string().min(1, "Content is required"),
  cover_image_url: nullableUrl,
  author: z.string().trim().max(120).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(60)).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
  meta_title: z.string().trim().max(200).optional().nullable(),
  meta_description: z.string().trim().max(400).optional().nullable(),
  meta_keywords: z.array(z.string().trim().min(1).max(60)).default([]),
});

export type AdminBlogInput = z.infer<typeof adminBlogInputSchema>;
export type AdminBlogUpdate = Partial<AdminBlogInput>;
