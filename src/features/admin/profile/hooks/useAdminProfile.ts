import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { qk } from "@/lib/queryKeys";
import {
  changeAdminPassword,
  getAdminProfile,
  updateAdminProfile,
} from "@/services/adminProfile.service";
import type { AdminProfileUpdateInput } from "@/features/admin/profile/adminProfile.schema";

export function useAdminProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? qk.adminProfile.me(userId) : ["admin-profile", "none"],
    queryFn: () => getAdminProfile(userId!),
    enabled: !!userId,
  });
}

export function useUpdateAdminProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminProfileUpdateInput) =>
      updateAdminProfile(user!.id, input),
    onSuccess: () => {
      toast.success("Profile updated successfully.");
      if (user?.id) {
        qc.invalidateQueries({ queryKey: qk.adminProfile.me(user.id) });
        qc.invalidateQueries({ queryKey: qk.profile.me(user.id) });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChangeAdminPassword() {
  return useMutation({
    mutationFn: (newPassword: string) => changeAdminPassword(newPassword),
    onSuccess: () => toast.success("Password updated successfully."),
    onError: (e: Error) => toast.error(e.message),
  });
}
