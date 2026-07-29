import { z } from "zod";
import { adminClubInputSchema, type AdminClubInput, type AdminClubUpdate } from "@/schemas/club.schema";

export { adminClubInputSchema };
export type { AdminClubInput, AdminClubUpdate };

// Kept for any legacy imports
export const clubSocialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(40),
  url: z.string().url(),
});
