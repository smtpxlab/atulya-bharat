import { z } from "zod";

export const activityLogInputSchema = z.object({
  registration_id: z.string().uuid().nullable().optional(),
  challenge_id: z.string().uuid().nullable().optional(),
  activity_date: z.string().min(1),
  activity_type: z.enum(["run", "walk", "ride"]),
  distance_km: z.number().positive().max(500),
  notes: z.string().trim().max(500).optional().nullable(),
});
export type ActivityLogInput = z.infer<typeof activityLogInputSchema>;
