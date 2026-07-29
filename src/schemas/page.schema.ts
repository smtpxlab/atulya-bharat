import { z } from "zod";

export const pageStatusSchema = z.enum(["enabled", "disabled"]);

export const adminPageInputSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, hyphens only"),
  content: z.string().default(""),
  status: pageStatusSchema.default("enabled"),
});

export const adminPageUpdateSchema = adminPageInputSchema.partial();

export type AdminPageInput = z.infer<typeof adminPageInputSchema>;
export type AdminPageUpdate = z.infer<typeof adminPageUpdateSchema>;
