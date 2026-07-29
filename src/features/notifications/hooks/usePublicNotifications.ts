import { useQuery } from "@tanstack/react-query";
import { notificationService } from "@/services/notification.service";
import { qk } from "@/lib/queryKeys";

export function usePublicNotifications() {
  return useQuery({
    queryKey: qk.notifications.publicActive(),
    queryFn: () => notificationService.getActiveNotifications(),
    staleTime: 60_000,
  });
}
