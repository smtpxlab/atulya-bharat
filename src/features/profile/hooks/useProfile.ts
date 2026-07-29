import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { qk } from "@/lib/queryKeys";
import {
  changePassword,
  getCreatedClubs,
  getJoinedClubs,
  getProfile,
  updateProfile,
} from "@/services/profile.service";
import type { ProfileUpdateInput } from "@/features/profile/profile.schema";
import { toast } from "sonner";

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId ? qk.profile.me(userId) : ["profile", "none"],
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileUpdateInput) => updateProfile(user!.id, input),
    onSuccess: () => {
      toast.success("Profile updated successfully.");
      if (user?.id) qc.invalidateQueries({ queryKey: qk.profile.me(user.id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChangePassword() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({
      oldPassword,
      newPassword,
    }: {
      oldPassword: string;
      newPassword: string;
    }) => changePassword(user!.email!, oldPassword, newPassword),
    onSuccess: () => toast.success("Password updated successfully."),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMyCreatedClubs() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId
      ? qk.dashboard.createdClubs(userId)
      : ["dashboard", "created-clubs", "none"],
    queryFn: () => getCreatedClubs(userId!),
    enabled: !!userId,
  });
}

export function useMyJoinedClubs() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery({
    queryKey: userId
      ? qk.dashboard.joinedClubs(userId)
      : ["dashboard", "joined-clubs", "none"],
    queryFn: () => getJoinedClubs(userId!),
    enabled: !!userId,
  });
}
