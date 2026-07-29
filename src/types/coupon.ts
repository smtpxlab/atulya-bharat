export type CouponType = "fixed" | "percent";

export interface Coupon {
  id: string;
  coupon_name: string;
  coupon_type: CouponType;
  coupon_value: number;
  minimum_order_amount: number;
  coupon_frequency: number;
  coupon_used: number;
  details: string | null;
  expires_at: string | null;
  status: boolean;
  created_at: string;
  updated_at: string;
}

export type CouponListItem = Coupon;

export interface CouponFormData {
  coupon_name: string;
  coupon_type: CouponType;
  coupon_value: number;
  minimum_order_amount: number;
  coupon_frequency: number;
  details?: string | null;
  expires_at?: string | null;
  status: boolean;
}

export interface CouponListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CouponListResult {
  rows: Coupon[];
  total: number;
  page: number;
  pageSize: number;
}
