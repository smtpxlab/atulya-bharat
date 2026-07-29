import { z } from "zod";
import { activityModeSchema } from "./challenge.schema";
import { durationSchema } from "./checkout.schema";

export const registrationInputSchema = z.object({
  challenge_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  activity_mode: activityModeSchema,
  target_days: durationSchema(365),
});
export type RegistrationInput = z.infer<typeof registrationInputSchema>;
