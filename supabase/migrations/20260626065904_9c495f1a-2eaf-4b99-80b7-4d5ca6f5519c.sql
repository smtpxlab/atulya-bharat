
CREATE TABLE public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_name text NOT NULL UNIQUE,
  title text NOT NULL,
  provider text NOT NULL DEFAULT 'razorpay',
  key_id text NOT NULL,
  key_secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  other_details jsonb,
  last_enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateways TO authenticated;
GRANT ALL ON public.payment_gateways TO service_role;

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment gateways"
  ON public.payment_gateways
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- At most one active gateway per provider.
CREATE UNIQUE INDEX payment_gateways_one_active_per_provider
  ON public.payment_gateways (provider)
  WHERE is_active = true;

-- Stamp last_enabled_at when toggled to active.
CREATE OR REPLACE FUNCTION public.payment_gateways_stamp_enabled()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR OLD.is_active IS DISTINCT FROM true) THEN
    NEW.last_enabled_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payment_gateways_stamp_enabled
  BEFORE INSERT OR UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.payment_gateways_stamp_enabled();

-- Block delete of active gateway.
CREATE OR REPLACE FUNCTION public.payment_gateways_block_active_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active = true THEN
    RAISE EXCEPTION 'Cannot delete an active payment gateway. Disable it first.' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER payment_gateways_block_active_delete
  BEFORE DELETE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.payment_gateways_block_active_delete();

-- updated_at maintenance
CREATE TRIGGER payment_gateways_updated_at
  BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
