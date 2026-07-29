CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_name text NOT NULL,
  coupon_type text NOT NULL CHECK (coupon_type IN ('fixed','percent')),
  coupon_value numeric(10,2) NOT NULL,
  minimum_order_amount numeric(10,2) NOT NULL DEFAULT 0,
  coupon_frequency integer NOT NULL DEFAULT 1,
  coupon_used integer NOT NULL DEFAULT 0,
  details text,
  expires_at timestamptz,
  status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE UNIQUE INDEX idx_coupons_name ON public.coupons (lower(coupon_name));
CREATE INDEX idx_coupons_status ON public.coupons (status);
CREATE INDEX idx_coupons_expires_at ON public.coupons (expires_at);

CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();