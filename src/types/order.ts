export type OrderStatus = "created" | "paid" | "failed" | "refunded";

export type Order = {
  id: string;
  user_id: string;
  challenge_id: string;
  ticket_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  amount: number;
  currency: string;
  status: OrderStatus;
  created_at: string;
};
