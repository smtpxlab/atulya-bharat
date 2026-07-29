import { z } from "zod";
import { CLUB_TYPES } from "@/types/club";

const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => ""))
    .transform((v) => (v ? v : null))
    .nullable();

const optionalUrl = () =>
  z
    .union([z.string().url(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null))
    .nullable();

const optionalDate = () =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .nullable();

const socialLinksSchema = z
  .array(z.string().trim().url("Must be a valid URL"))
  .default([]);

export const userClubInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(160),
  club_type: z.enum(CLUB_TYPES, {
    errorMap: () => ({ message: "Pick a club type" }),
  }),
  promoter_name: z.string().trim().min(2, "Promoter name is required").max(160),
  promoter_email: z.string().trim().email("Invalid email").max(255),
  promoter_phone: z
    .string()
    .trim()
    .min(7, "Phone is required")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone"),
  promoter_address: optionalText(500),
  promoter_city: optionalText(120),
  promoter_state: optionalText(120),
  promoter_dob: optionalDate(),
  promoter_description: optionalText(20000),
  established_at: optionalDate(),
  member_count: z.coerce.number().int().min(0).default(0),
  banner_url: optionalUrl(),
  description: optionalText(20000),
  social_links: socialLinksSchema,
  meta_title: optionalText(300),
  meta_description: optionalText(500),
  meta_keywords: z.array(z.string().trim().min(1)).default([]),
});

export type UserClubInput = z.infer<typeof userClubInputSchema>;

export const adminClubInputSchema = userClubInputSchema.extend({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only"),
  logo_url: optionalUrl(),
  registration_code: optionalText(40),
  referral_code: optionalText(40),
  discount_challenge_percent: z.coerce.number().min(0).max(100).default(0),
  discount_cart_percent: z.coerce.number().min(0).max(100).default(0),
  tags: z.array(z.string().trim().min(1)).default([]),
  is_public: z.boolean().default(false),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  priority: z.coerce.number().int().min(0).max(9999).default(0),
});

export type AdminClubInput = z.infer<typeof adminClubInputSchema>;
export type AdminClubUpdate = Partial<AdminClubInput>;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
