import { supabase } from "@/integrations/supabase/client";
import type {
  Coupon,
  CouponFormData,
  CouponListParams,
  CouponListResult,
} from "@/types/coupon";

const TABLE = "coupons" as const;

function mapError(error: { code?: string; message: string }): Error {
  if (error.code === "23505") {
    return new Error("A coupon with this name already exists.");
  }
  return new Error(error.message);
}

function normalize(input: CouponFormData): CouponFormData {
  return {
    ...input,
    coupon_name: input.coupon_name.trim().toUpperCase(),
    details: input.details?.trim() ? input.details.trim() : null,
    expires_at: input.expires_at ?? null,
  };
}

export const couponService = {
  async listCoupons(params: CouponListParams = {}): Promise<CouponListResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(TABLE)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const search = params.search?.trim();
    if (search) {
      query = query.ilike("coupon_name", `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw mapError(error);
    return {
      rows: (data ?? []) as unknown as Coupon[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  async getCouponById(id: string): Promise<Coupon> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw mapError(error);
    if (!data) throw new Error("Coupon not found");
    return data as unknown as Coupon;
  },

  async createCoupon(input: CouponFormData): Promise<Coupon> {
    const payload = normalize(input);
    const { data, error } = await supabase
      .from(TABLE)
      .insert(payload as never)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Coupon;
  },

  async updateCoupon(id: string, input: CouponFormData): Promise<Coupon> {
    const payload = normalize(input);
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Coupon;
  },

  async deleteCoupon(id: string): Promise<{ id: string }> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw mapError(error);
    return { id };
  },

  async toggleCouponStatus(id: string, next: boolean): Promise<Coupon> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: next } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Coupon;
  },
};
