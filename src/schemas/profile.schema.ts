import { z } from "zod";

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  username: z.string().trim().min(2).max(50).nullable().optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
