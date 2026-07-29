import { z } from "zod";

export const CHALLENGE_TYPES = ["Any", "Ride", "Run/Walk"] as const;
export const CHALLENGE_CATEGORIES = [
  "New",
  "Featured",
  "Popular",
  "Best Seller",
] as const;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const ticketSchema = z.object({
  id: z.string().optional(),
  ticket_name: z.string().trim().min(1, "Ticket name is required").max(120),
  ticket_price: z.coerce.number().min(0, "Price must be ≥ 0"),
  ticket_inclusions: z
    .string()
    .trim()
    .min(1, "Inclusions are required")
    .max(2000),
  shipping_cost: z.coerce.number().min(0, "Shipping must be ≥ 0").default(0),
  allow_certificate: z.boolean().default(false),
});
export type TicketInput = z.infer<typeof ticketSchema>;

const optionalUrl = z
  .union([z.string().url(), z.literal("")])
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const challengeFormSchema = z
  .object({
    name: z.string().trim().min(1, "Challenge name is required").max(160),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes"),
    challenge_type: z.enum(CHALLENGE_TYPES),
    category: z.enum(CHALLENGE_CATEGORIES),
    tags: z.array(z.string().trim().min(1)).default([]),
    cover_image_url: z.string().url("Cover image is required"),
    about_map_image_url: optionalUrl,
    creative_image_url: optionalUrl,
    certificate_image_url: optionalUrl,
    bib_image_url: optionalUrl,
    route_map_image_url: optionalUrl,
    distance: z.coerce.number().positive("Distance must be greater than 0"),
    max_duration_days: z.coerce
      .number()
      .int()
      .positive("Maximum duration days must be greater than 0"),
    start_at: z.string().min(1, "Start date & time is required"),
    end_at: z.string().nullable().optional(),
    description: z
      .string()
      .min(1, "Description is required")
      .refine((v) => v.replace(/<[^>]*>/g, "").trim().length > 0, {
        message: "Description is required",
      }),
    status: z.boolean().default(true),
    tickets: z.array(ticketSchema).min(1, "At least one ticket is required"),
    meta_title: z.string().trim().max(300).optional().nullable(),
    meta_description: z.string().trim().max(500).optional().nullable(),
    meta_keywords: z.array(z.string().trim().min(1)).default([]),
  })
  .refine(
    (v) => !v.end_at || new Date(v.end_at) > new Date(v.start_at),
    { path: ["end_at"], message: "End date must be after start date" },
  );

export type ChallengeFormValues = z.infer<typeof challengeFormSchema>;
