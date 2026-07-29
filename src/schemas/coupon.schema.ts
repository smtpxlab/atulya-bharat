import { z } from "zod";

export const couponSchema = z
  .object({
    coupon_name: z
      .string()
      .trim()
      .min(1, "Coupon name is required")
      .max(50, "Coupon name must be 50 characters or less")
      .transform((v) => v.toUpperCase()),
    coupon_type: z.enum(["fixed", "percent"], {
      required_error: "Coupon type is required",
    }),
    coupon_value: z.coerce.number({
      invalid_type_error: "Coupon value is required",
    }),
    minimum_order_amount: z.coerce
      .number({ invalid_type_error: "Minimum order amount is required" })
      .min(0, "Minimum order amount must be 0 or more"),
    coupon_frequency: z.coerce
      .number({ invalid_type_error: "Coupon frequency is required" })
      .int("Coupon frequency must be a whole number")
      .min(1, "Coupon frequency must be at least 1"),
    details: z.string().trim().max(2000).optional().nullable(),
    expires_at: z
      .union([z.string(), z.date(), z.null()])
      .optional()
      .transform((v) => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString();
        return v;
      }),
    status: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.coupon_type === "fixed") {
      if (!(data.coupon_value > 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coupon_value"],
          message: "Value must be greater than 0",
        });
      }
    } else if (data.coupon_type === "percent") {
      if (data.coupon_value < 1 || data.coupon_value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coupon_value"],
          message: "Value must be between 1 and 100",
        });
      }
    }
  });

export type CouponInput = z.infer<typeof couponSchema>;
