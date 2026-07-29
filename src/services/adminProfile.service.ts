import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/types/profile";
import {
  adminProfileUpdateSchema,
  type AdminProfileUpdateInput,
} from "@/features/admin/profile/adminProfile.schema";
import { toServiceError } from "./errors";

export const getAdminProfile = async (
  adminId: string,
): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", adminId)
    .maybeSingle();
  if (error) throw toServiceError(error, "Could not load profile");
  return (data as Profile) ?? null;
};

export const updateAdminProfile = async (
  adminId: string,
  input: AdminProfileUpdateInput,
): Promise<Profile> => {
  const parsed = adminProfileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw toServiceError(
      parsed.error,
      parsed.error.issues[0]?.message ?? "Invalid profile",
    );
  }
  const v = parsed.data;
  // Map spec fields → existing columns (contact→mobile, pin_code→pincode)
  const update = {
    full_name: v.full_name,
    username: v.username,
    mobile: v.contact,
    shop_name: v.shop_name || null,
    address: v.address || null,
    state: v.state || null,
    city: v.city || null,
    pincode: v.pin_code || null,
  };
  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", adminId)
    .select("*")
    .single();
  if (error) throw toServiceError(error, "Could not update profile");
  return data as Profile;
};

export const changeAdminPassword = async (
  newPassword: string,
): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw toServiceError(error, "Could not update password");
};
