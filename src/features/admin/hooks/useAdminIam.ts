import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { iamService, type AppRole } from "@/services/iam.service";

const IAM_KEY = ["admin", "iam"] as const;

export function useIamUsers(params: { search?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: [...IAM_KEY, "users", params],
    queryFn: () => iamService.listUsers(params),
    placeholderData: (prev) => prev,
  });
}

export function useIamUserSessions(userId: string | null) {
  return useQuery({
    queryKey: [...IAM_KEY, "user-sessions", userId],
    queryFn: () => iamService.userSessions(userId!),
    enabled: !!userId,
  });
}

export function useAuditLogs(params: { limit?: number; offset?: number; category?: string }) {
  return useQuery({
    queryKey: [...IAM_KEY, "audit-logs", params],
    queryFn: () => iamService.auditLogs(params),
    placeholderData: (prev) => prev,
  });
}

export function useLoginAttempts(params: { limit?: number; offset?: number; success?: boolean }) {
  return useQuery({
    queryKey: [...IAM_KEY, "login-attempts", params],
    queryFn: () => iamService.loginAttempts(params),
    placeholderData: (prev) => prev,
  });
}

function useIamMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: IAM_KEY }),
  });
}

export const useSetUserActive = () =>
  useIamMutation(({ id, isActive }: { id: string; isActive: boolean }) =>
    iamService.setActive(id, isActive),
  );

export const useUnlockUser = () => useIamMutation((id: string) => iamService.unlock(id));

export const useForcePasswordReset = () =>
  useIamMutation((id: string) => iamService.forcePasswordReset(id));

export const useGrantRole = () =>
  useIamMutation(({ id, role }: { id: string; role: AppRole }) => iamService.grantRole(id, role));

export const useRevokeRole = () =>
  useIamMutation(({ id, role }: { id: string; role: AppRole }) => iamService.revokeRole(id, role));

export const useRevokeUserSessions = () =>
  useIamMutation((id: string) => iamService.revokeUserSessions(id));
