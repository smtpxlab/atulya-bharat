import { z } from "zod";

export const adminProfileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(120),
  username: z.string().trim().min(1, "Username is required").max(60),
  contact: z
    .string()
    .trim()
    .min(7, "Contact is required")
    .max(20, "Contact too long")
    .regex(/^[0-9+\-\s()]+$/, "Invalid contact number"),
  shop_name: z.string().trim().max(150).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  pin_code: z.string().trim().max(20).optional().or(z.literal("")),
});

export type AdminProfileUpdateInput = z.infer<typeof adminProfileUpdateSchema>;

export const adminChangePasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;
