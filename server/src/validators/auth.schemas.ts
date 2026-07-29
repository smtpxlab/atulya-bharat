import { z } from "zod";
import { APP_ROLES } from "../middleware/requireRole";

export const emailSchema = z.string().trim().toLowerCase().email().max(255);
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password too long");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(120).optional(),
  remember: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  /** "Remember me" — long-lived refresh cookie instead of a session cookie. */
  remember: z.boolean().optional(),
});

/** Refresh token normally arrives in the HTTP-only cookie; body is optional. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
  allDevices: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(10),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

/* ── admin IAM ─────────────────────────────────────────────────────────────── */

export const roleMutationSchema = z.object({
  role: z.enum(APP_ROLES),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
