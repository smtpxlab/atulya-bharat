import { supabase } from "@/integrations/supabase/client";

export interface PaymentGateway {
  id: string;
  payment_name: string;
  title: string;
  provider: string;
  key_id: string;
  key_secret: string;
  is_active: boolean;
  other_details: Record<string, unknown> | null;
  last_enabled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentGatewayInput {
  payment_name: string;
  title: string;
  provider?: string;
  key_id: string;
  /** Leave undefined or empty on edit to keep the existing secret. */
  key_secret?: string;
  is_active: boolean;
  other_details?: Record<string, unknown> | null;
}

const TABLE = "payment_gateways" as const;

function rethrow(prefix: string, error: unknown): never {
  const msg = (error as { message?: string })?.message ?? "Unknown error";
  // 23505 = unique_violation (single-active index)
  if (/payment_gateways_one_active_per_provider/.test(msg)) {
    throw new Error(
      "Another payment gateway is already active for this provider. Disable it first.",
    );
  }
  throw new Error(`${prefix}: ${msg}`);
}

export async function listPaymentGateways(): Promise<PaymentGateway[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) rethrow("Failed to load gateways", error);
  return (data ?? []) as PaymentGateway[];
}

export async function getPaymentGateway(id: string): Promise<PaymentGateway> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) rethrow("Failed to load gateway", error);
  if (!data) throw new Error("Gateway not found");
  return data as PaymentGateway;
}

export async function createPaymentGateway(
  input: PaymentGatewayInput,
): Promise<PaymentGateway> {
  if (!input.key_secret) {
    throw new Error("Razorpay Secret is required");
  }
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{
      payment_name: input.payment_name.trim(),
      title: input.title.trim(),
      provider: input.provider ?? "razorpay",
      key_id: input.key_id.trim(),
      key_secret: input.key_secret,
      is_active: input.is_active,
      other_details: (input.other_details ?? null) as never,
    }])
    .select()
    .single();
  if (error) rethrow("Failed to create gateway", error);
  return data as PaymentGateway;
}

export async function updatePaymentGateway(
  id: string,
  input: PaymentGatewayInput,
): Promise<PaymentGateway> {
  const patch: Record<string, unknown> = {
    payment_name: input.payment_name.trim(),
    title: input.title.trim(),
    provider: input.provider ?? "razorpay",
    key_id: input.key_id.trim(),
    is_active: input.is_active,
    other_details: input.other_details ?? null,
  };
  if (input.key_secret && input.key_secret.length > 0) {
    patch.key_secret = input.key_secret;
  }
  const { data, error } = await supabase
    .from(TABLE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", id)
    .select()
    .single();
  if (error) rethrow("Failed to update gateway", error);
  return data as PaymentGateway;
}

export async function setPaymentGatewayActive(
  id: string,
  isActive: boolean,
): Promise<PaymentGateway> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .single();
  if (error) rethrow("Failed to update status", error);
  return data as PaymentGateway;
}

export async function deletePaymentGateway(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) rethrow("Failed to delete gateway", error);
}

export function maskKeyId(keyId: string): string {
  if (!keyId) return "";
  if (keyId.length <= 8) return `${keyId.slice(0, 2)}••••`;
  return `${keyId.slice(0, 4)}••••${keyId.slice(-4)}`;
}
