import { createRazorpayOrder, verifyRazorpayPayment } from "./payment.service";
import { registrationInputSchema, type RegistrationInput } from "@/schemas/registration.schema";
import { toServiceError } from "./errors";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

export type RegisterForChallengeArgs = RegistrationInput & {
  challengeTitle: string;
  userEmail?: string;
  coupon_code?: string | null;
  promoter_discount_paise?: number;
  club_discount_paise?: number;
};

export type RegisterForChallengeResult = {
  registration_id?: string;
  free: boolean;
};

/**
 * Orchestrates a paid challenge registration end-to-end:
 *  1. Validate input
 *  2. Create a Razorpay order (server applies trusted discounts)
 *  3. If the resulting amount is 0 (e.g. 100% coupon), skip Razorpay — the
 *     server already created the registration. Otherwise open Razorpay and
 *     verify the signature server-side.
 */
export const registerForChallenge = async (
  args: RegisterForChallengeArgs,
): Promise<RegisterForChallengeResult> => {
  const parsed = registrationInputSchema.safeParse({
    challenge_id: args.challenge_id,
    ticket_id: args.ticket_id,
    activity_mode: args.activity_mode,
    target_days: args.target_days,
  });
  if (!parsed.success) {
    throw toServiceError(parsed.error, parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const order = await createRazorpayOrder({
    challenge_id: parsed.data.challenge_id,
    ticket_id: parsed.data.ticket_id,
    activity_mode: parsed.data.activity_mode,
    target_days: parsed.data.target_days,
    coupon_code: args.coupon_code ?? null,
    promoter_discount_paise: args.promoter_discount_paise ?? 0,
    club_discount_paise: args.club_discount_paise ?? 0,
  });

  if (order.free) {
    return { registration_id: order.registration_id, free: true };
  }

  const ok = await loadRazorpay();
  if (!ok) throw toServiceError(new Error("Razorpay failed to load"), "Could not load checkout");

  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: "Atulya Bharat Run",
      description: args.challengeTitle,
      prefill: { email: args.userEmail ?? "" },
      theme: { color: "#FF6B1A" },
      handler: async (response: any) => {
        try {
          await verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            challenge_id: parsed.data.challenge_id,
            ticket_id: parsed.data.ticket_id,
            activity_mode: parsed.data.activity_mode,
            target_days: parsed.data.target_days,
            coupon_code: args.coupon_code ?? null,
            promoter_discount_paise: args.promoter_discount_paise ?? 0,
            club_discount_paise: args.club_discount_paise ?? 0,
          });
          resolve();
        } catch (e) {
          reject(toServiceError(e, "Payment verification failed"));
        }
      },
      modal: {
        ondismiss: () => reject(toServiceError(new Error("dismissed"), "Payment cancelled", { code: "user_cancelled" })),
      },
    });
    rzp.open();
  });

  return { free: false };
};
