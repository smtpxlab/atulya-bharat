ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_discount_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promoter_discount_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS club_discount_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_paise integer;