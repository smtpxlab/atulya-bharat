import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { securityService } from "@/services/iam.service";

const KEY = ["account", "security"] as const;

export const useMySessions = () =>
  useQuery({ queryKey: [...KEY, "sessions"], queryFn: () => securityService.listSessions() });

export const useMyDevices = () =>
  useQuery({ queryKey: [...KEY, "devices"], queryFn: () => securityService.listDevices() });

export const useMyLoginHistory = (limit = 50) =>
  useQuery({
    queryKey: [...KEY, "login-history", limit],
    queryFn: () => securityService.loginHistory(limit),
  });

function useSecurityMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export const useRevokeMySession = () =>
  useSecurityMutation((id: string) => securityService.revokeSession(id));

export const useRevokeAllMySessions = () =>
  useSecurityMutation<void>(() => securityService.revokeAllSessions());

export const useRemoveMyDevice = () =>
  useSecurityMutation((id: string) => securityService.removeDevice(id));

export const useChangeMyPassword = () =>
  useSecurityMutation(({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
    securityService.changePassword(currentPassword, newPassword),
  );
