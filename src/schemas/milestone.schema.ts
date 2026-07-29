import { z } from "zod";

// Quick HTML strip for "description has visible text" validation
const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const milestoneFormSchema = z.object({
  challenge_id: z.string().uuid("Please choose a challenge"),
  spot_name: z.string().trim().min(1, "Spot name is required").max(200),
  distance: z.coerce.number().min(0, "Distance must be ≥ 0"),
  spot_image_url: z.string().url().nullable().optional().transform((v) => v ?? null),
  audio_url: z.string().url().nullable().optional().transform((v) => v ?? null),
  description: z
    .string()
    .min(1, "Description is required")
    .refine((v) => stripHtml(v).length > 0, "Description is required"),
  status: z.boolean().default(true),
});

export type MilestoneFormSchema = z.infer<typeof milestoneFormSchema>;
