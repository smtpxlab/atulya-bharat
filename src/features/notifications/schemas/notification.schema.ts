import { z } from "zod";

export const notificationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Title is required" })
    .max(150, { message: "Title must be 150 characters or less" }),
  message: z
    .string()
    .trim()
    .min(1, { message: "Message is required" })
    .max(500, { message: "Message must be 500 characters or less" }),
  status: z.boolean().default(true),
});

export type NotificationInput = z.infer<typeof notificationSchema>;
