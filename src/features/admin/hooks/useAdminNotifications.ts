import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "@/services/notification.service";
import { qk } from "@/lib/queryKeys";
import type {
  NotificationFormData,
  NotificationListParams,
} from "@/types/notification";

export function useNotificationsAdmin(params: NotificationListParams) {
  return useQuery({
    queryKey: qk.notifications.adminList(params as Record<string, unknown>),
    queryFn: () => notificationService.listAdmin(params),
    placeholderData: (prev) => prev,
  });
}

export function useNotification(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.notifications.detail(id) : ["notifications", "detail", "none"],
    queryFn: () => notificationService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationFormData) => notificationService.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications.all }),
  });
}

export function useUpdateNotification(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationFormData) => notificationService.update(id, input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.notifications.all });
      qc.setQueryData(qk.notifications.detail(id), data);
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications.all }),
  });
}

export function useToggleNotificationPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) =>
      notificationService.setPublished(id, next),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.notifications.all });
      qc.setQueryData(qk.notifications.detail(data.id), data);
    },
  });
}
