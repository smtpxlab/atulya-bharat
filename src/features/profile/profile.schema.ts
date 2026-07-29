import { z } from "zod";

const optionalString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable();

export const GENDERS = ["Male", "Female", "Other"] as const;

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(120),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Mobile must be 10–15 digits")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable(),
  gender: z
    .enum(GENDERS)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  dob: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable(),
  house_no: optionalString(80),
  address: optionalString(300),
  city: optionalString(80),
  state: optionalString(80),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/, "Pincode must be 4–10 digits")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((d) => d.newPassword !== d.oldPassword, {
    path: ["newPassword"],
    message: "New password must be different from old password",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
