import { z } from "zod";

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

export const faqSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .max(300, "Question must be 300 characters or less"),
  answer: z
    .string()
    .min(1, "Answer is required")
    .refine((v) => stripHtml(v).length > 0, "Answer is required"),
  status: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).default(0),
});

export type FaqInput = z.infer<typeof faqSchema>;
