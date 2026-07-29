import { z } from "zod";

export const contactEnquirySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().max(20).optional().default(""),
  subject: z.string().trim().min(1, "Subject is required").max(150),
  message: z.string().trim().min(1, "Message is required").max(3000),
});
export type ContactEnquiryInput = z.infer<typeof contactEnquirySchema>;
