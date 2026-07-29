import { supabase } from "@/integrations/supabase/client";
import { toServiceError } from "./errors";

export type CreateOrderInput = {
  challenge_id: string;
  ticket_id: string;
  activity_mode?: string;
  target_days?: number | null;
  coupon_code?: string | null;
  promoter_discount_paise?: number;
  club_discount_paise?: number;
};

export type CreateOrderResult = {
  free: boolean;
  order_id?: string;
  key_id?: string;
  amount: number;
  currency: string;
  ticket_name?: string;
  subtotal_paise: number;
  coupon_discount_paise: number;
  promoter_discount_paise: number;
  club_discount_paise: number;
  final_paise: number;
  registration_id?: string;
  transaction_id?: string;
};

export const createRazorpayOrder = async (
  input: CreateOrderInput,
): Promise<CreateOrderResult> => {
  const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
    body: input,
  });
  if (error || !data || (data.free !== true && !data.order_id)) {
    const msg = data?.message ?? data?.error ?? error?.message ?? "Could not start payment";
    throw toServiceError(error ?? new Error(msg), msg, { code: data?.error });
  }
  return data as CreateOrderResult;
};

export type VerifyPaymentInput = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  challenge_id: string;
  ticket_id: string;
  activity_mode: string;
  target_days: number;
  coupon_code?: string | null;
  promoter_discount_paise?: number;
  club_discount_paise?: number;
};

export const verifyRazorpayPayment = async (input: VerifyPaymentInput): Promise<void> => {
  const { data, error } = await supabase.functions.invoke("verify-razorpay-payment", {
    body: input,
  });
  if (error || !data?.success) {
    const msg = data?.message ?? data?.error ?? error?.message ?? "Payment verification failed";
    throw toServiceError(error ?? new Error(msg), msg, { code: data?.error });
  }
};

export type MockBookingInput = {
  challenge_id: string;
  ticket_id: string;
  activity_mode: string;
  target_days: number;
  coupon_code?: string | null;
  coupon_discount_paise?: number;
  promoter_discount_paise?: number;
  club_discount_paise?: number;
};

export type MockBookingResult = {
  success: boolean;
  registration_id: string;
  transaction_id: string;
  amount_paise: number;
};

export const completeMockBooking = async (
  input: MockBookingInput,
): Promise<MockBookingResult> => {
  const { data, error } = await supabase.functions.invoke(
    "complete-mock-booking",
    { body: input },
  );
  if (error || !data?.success) {
    const msg = data?.message ?? data?.error ?? error?.message ?? "Booking failed";
    throw toServiceError(error ?? new Error(msg), msg, { code: data?.error });
  }
  return data as MockBookingResult;
};
