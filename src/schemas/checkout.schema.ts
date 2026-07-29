import { z } from "zod";

export const couponCodeSchema = z
  .string()
  .trim()
  .min(2, "Enter a coupon code")
  .max(40);

export const durationSchema = (max: number | null) =>
  z
    .number({ invalid_type_error: "Enter number of days" })
    .int("Must be a whole number")
    .min(1, "Must be at least 1 day")
    .max(max ?? 365, max ? `Must be ${max} days or fewer` : "Too many days");

export const checkoutAddressSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(120),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Mobile must be 10–15 digits"),
  house_no: z.string().trim().min(1, "House / Flat is required").max(80),
  address: z.string().trim().min(1, "Address is required").max(300),
  city: z.string().trim().min(1, "City is required").max(80),
  state: z.string().trim().min(1, "State is required").max(80),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/, "Pincode must be 4–10 digits"),
});
export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;
