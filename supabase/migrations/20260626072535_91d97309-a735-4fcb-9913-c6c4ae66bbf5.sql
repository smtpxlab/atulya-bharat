
-- Extend orders into a permanent booking ledger

-- Sequence for booking numbers
CREATE SEQUENCE IF NOT EXISTS public.orders_booking_seq START 1;

-- Add columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS booking_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS gateway_mode text,
  ADD COLUMN IF NOT EXISTS signature_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gateway_response_json jsonb,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS original_amount_paise integer,
  ADD COLUMN IF NOT EXISTS final_amount_paise integer,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.challenge_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS challenge_id uuid REFERENCES public.challenges(id) ON DELETE SET NULL;

-- Generated discount column
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount_paise integer
  GENERATED ALWAYS AS (
    COALESCE(coupon_discount_paise,0) + COALESCE(promoter_discount_paise,0) + COALESCE(club_discount_paise,0)
  ) STORED;

-- Booking number trigger
CREATE OR REPLACE FUNCTION public.orders_assign_booking_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.booking_number IS NULL THEN
    NEW.booking_number := 'AB-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.orders_booking_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_booking_number ON public.orders;
CREATE TRIGGER trg_orders_booking_number
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_assign_booking_number();

-- Block deletes (audit)
CREATE OR REPLACE FUNCTION public.orders_block_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'orders are an immutable audit ledger and cannot be deleted'
    USING ERRCODE = '42501';
END $$;

DROP TRIGGER IF EXISTS trg_orders_block_delete ON public.orders;
CREATE TRIGGER trg_orders_block_delete
BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_block_delete();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_booking_number ON public.orders(booking_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_challenge ON public.orders(challenge_id);
CREATE INDEX IF NOT EXISTS idx_orders_coupon ON public.orders(coupon_code);

-- Backfill existing rows
UPDATE public.orders o SET
  original_amount_paise = COALESCE(o.subtotal_paise, o.amount_paise),
  final_amount_paise = COALESCE(o.final_amount_paise, o.amount_paise),
  challenge_id = COALESCE(o.challenge_id, r.challenge_id),
  ticket_id = COALESCE(o.ticket_id, r.ticket_id),
  payment_status = CASE
    WHEN o.payment_status <> 'pending' THEN o.payment_status
    WHEN o.status::text = 'paid' THEN 'paid'
    WHEN o.status::text = 'failed' THEN 'failed'
    WHEN o.status::text = 'refund_pending' THEN 'refunded'
    WHEN o.status::text = 'cancelled' THEN 'cancelled'
    ELSE 'pending'
  END,
  signature_verified = CASE
    WHEN o.signature_verified THEN true
    WHEN o.razorpay_signature IS NOT NULL AND o.razorpay_signature NOT IN ('FREE','') THEN true
    ELSE false
  END,
  gateway = COALESCE(o.gateway, 'razorpay'),
  gateway_mode = COALESCE(o.gateway_mode,
    CASE WHEN o.razorpay_signature = 'FREE' THEN 'n/a' ELSE NULL END)
FROM public.registrations r
WHERE r.id = o.registration_id;

-- Backfill booking numbers for existing rows
UPDATE public.orders SET booking_number = 'AB-' || to_char(created_at,'YYYY') || '-' ||
  lpad(nextval('public.orders_booking_seq')::text, 6, '0')
WHERE booking_number IS NULL;

-- Admin booking stats RPC
CREATE OR REPLACE FUNCTION public.admin_booking_stats(_challenge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'bookings_total', COUNT(*),
    'paid_count', COUNT(*) FILTER (WHERE payment_status = 'paid'),
    'pending_count', COUNT(*) FILTER (WHERE payment_status = 'pending'),
    'failed_count', COUNT(*) FILTER (WHERE payment_status = 'failed'),
    'refunded_count', COUNT(*) FILTER (WHERE payment_status = 'refunded'),
    'revenue_paise', COALESCE(SUM(final_amount_paise) FILTER (WHERE payment_status = 'paid'), 0),
    'paid_amount_paise', COALESCE(SUM(final_amount_paise) FILTER (WHERE payment_status = 'paid'), 0),
    'pending_amount_paise', COALESCE(SUM(final_amount_paise) FILTER (WHERE payment_status = 'pending'), 0),
    'refunded_amount_paise', COALESCE(SUM(final_amount_paise) FILTER (WHERE payment_status = 'refunded'), 0),
    'registered_users', COUNT(DISTINCT user_id) FILTER (WHERE payment_status = 'paid')
  ) INTO v
  FROM public.orders WHERE challenge_id = _challenge_id;
  RETURN v;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_booking_stats(uuid) TO authenticated;
