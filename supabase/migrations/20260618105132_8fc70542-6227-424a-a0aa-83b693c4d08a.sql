
-- Enum for status
DO $$ BEGIN
  CREATE TYPE public.newsletter_status AS ENUM ('subscribed', 'unsubscribed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  status public.newsletter_status NOT NULL DEFAULT 'subscribed',
  source text,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX newsletter_subscribers_status_idx ON public.newsletter_subscribers (status);
CREATE INDEX newsletter_subscribers_created_at_idx ON public.newsletter_subscribers (created_at DESC);

-- Grants
GRANT SELECT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

-- RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage newsletter subscribers"
  ON public.newsletter_subscribers
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- updated_at trigger (reusing existing update_updated_at_column)
CREATE TRIGGER update_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public subscribe RPC (handles duplicates + reactivation)
CREATE OR REPLACE FUNCTION public.subscribe_to_newsletter(_email text, _source text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_existing public.newsletter_subscribers%ROWTYPE;
BEGIN
  v_email := lower(btrim(coalesce(_email, '')));
  IF v_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT * INTO v_existing FROM public.newsletter_subscribers WHERE email = v_email;

  IF FOUND THEN
    IF v_existing.status = 'subscribed' THEN
      RETURN jsonb_build_object('status', 'duplicate');
    ELSE
      UPDATE public.newsletter_subscribers
        SET status = 'subscribed',
            subscribed_at = now(),
            unsubscribed_at = NULL,
            source = COALESCE(_source, source)
        WHERE id = v_existing.id;
      RETURN jsonb_build_object('status', 'reactivated');
    END IF;
  END IF;

  INSERT INTO public.newsletter_subscribers (email, source)
  VALUES (v_email, _source);

  RETURN jsonb_build_object('status', 'subscribed');
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(text, text) TO anon, authenticated;
