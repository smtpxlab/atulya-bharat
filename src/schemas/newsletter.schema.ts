import { z } from "zod";

export const newsletterEmailSchema = z
  .string()
  .trim()
  .min(1, { message: "Email is required" })
  .max(255, { message: "Email must be 255 characters or less" })
  .email({ message: "Please enter a valid email" });

export const newsletterSubscribeSchema = z.object({
  email: newsletterEmailSchema,
  source: z.string().max(50).optional(),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
