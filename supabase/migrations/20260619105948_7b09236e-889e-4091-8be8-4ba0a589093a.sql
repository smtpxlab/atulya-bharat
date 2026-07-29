
-- ============================================================
-- Security hardening 2/3 — Lock down SECURITY DEFINER execute
-- grants and gate coupon validation behind an RPC.
-- ============================================================

-- ---------- validate_coupon RPC ----------
CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.coupons%ROWTYPE;
  discount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'auth_required');
  END IF;

  IF _code IS NULL OR length(btrim(_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_code');
  END IF;

  IF _subtotal IS NULL OR _subtotal < 0 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_subtotal');
  END IF;

  SELECT * INTO c
  FROM public.coupons
  WHERE upper(coupon_name) = upper(btrim(_code))
  LIMIT 1;

  IF NOT FOUND OR NOT c.status THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  IF c.coupon_frequency > 0 AND c.coupon_used >= c.coupon_frequency THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'exhausted');
  END IF;

  IF _subtotal < COALESCE(c.minimum_order_amount, 0) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'min_order',
      'minimum_order_amount', c.minimum_order_amount
    );
  END IF;

  discount := CASE
    WHEN c.coupon_type = 'percent' THEN (_subtotal * c.coupon_value) / 100
    ELSE c.coupon_value
  END;
  discount := LEAST(GREATEST(0, round(discount, 2)), _subtotal);

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_name', c.coupon_name,
    'coupon_type', c.coupon_type,
    'discount', discount
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO authenticated;

-- ---------- Internal helpers (RLS / triggers only) ----------
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_club_member_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clubs_enforce_pending_for_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- ---------- Public RPCs (explicit grants) ----------
GRANT EXECUTE ON FUNCTION public.global_leaderboard(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hall_of_fame(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_leaderboard(uuid, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(text, text) TO anon, authenticated;
