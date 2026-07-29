import { z } from "zod";

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

export const testimonialSchema = z.object({
  author_name: z
    .string()
    .trim()
    .min(1, "Author name is required")
    .max(120, "Author name must be 120 characters or less"),
  image_url: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  description: z
    .string()
    .min(1, "Description is required")
    .refine((v) => stripHtml(v).length > 0, "Description is required"),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type TestimonialInput = z.infer<typeof testimonialSchema>;
