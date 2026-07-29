import { useEffect, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userNotificationsService } from "@/services/userNotifications.service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const KEYS = {
  list: ["user-notifications", "list"] as const,
  unread: ["user-notifications", "unread"] as const,
};

export function useUserNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: KEYS.list,
    queryFn: () => userNotificationsService.list(50),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const instanceId = useId();

  const q = useQuery({
    queryKey: KEYS.unread,
    queryFn: () => userNotificationsService.unreadCount(),
    enabled: !!user?.id,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`user-notif-${user.id}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: KEYS.list });
          qc.invalidateQueries({ queryKey: KEYS.unread });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, qc, instanceId]);

  return q;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => userNotificationsService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.unread });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => userNotificationsService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.unread });
    },
  });
}
