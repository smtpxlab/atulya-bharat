import { z } from "zod";

export const activityModeSchema = z.enum(["run", "walk", "ride", "any"]);
export type ActivityModeInput = z.infer<typeof activityModeSchema>;

export const challengeFiltersSchema = z.object({
  activity: z.enum(["all", "run", "walk", "ride"]).default("all"),
  distance: z.enum(["any", "lt30", "30to60", "gt60"]).default("any"),
  sort: z.enum(["featured", "newest", "price_asc"]).default("featured"),
});
export type ChallengeFilters = z.infer<typeof challengeFiltersSchema>;

export const challengeSlugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Invalid slug");
