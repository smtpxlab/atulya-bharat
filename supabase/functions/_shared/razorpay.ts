// Shared helper: resolve active Razorpay credentials.
// Priority: active row in public.payment_gateways (provider='razorpay'),
// then environment variables (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) as fallback.
// Must be called with a SERVICE-ROLE Supabase client — the row contains the secret.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export interface RazorpayCreds {
  keyId: string;
  keySecret: string;
  source: "db" | "env";
}

export async function getRazorpayCreds(
  admin: SupabaseClient,
): Promise<RazorpayCreds> {
  const { data, error } = await admin
    .from("payment_gateways")
    .select("key_id, key_secret")
    .eq("provider", "razorpay")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("payment_gateways lookup error", error);
  }

  if (data?.key_id && data?.key_secret) {
    return { keyId: data.key_id, keySecret: data.key_secret, source: "db" };
  }

  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (keyId && keySecret) {
    return { keyId, keySecret, source: "env" };
  }

  throw new Error("No Razorpay configuration available");
}
