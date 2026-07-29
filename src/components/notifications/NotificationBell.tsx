import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Mountain, Trophy, AlertTriangle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  useUnreadCount,
  useUserNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/features/notifications/hooks/useUserNotifications";
import type { UserNotification } from "@/services/userNotifications.service";

const iconFor = (type: UserNotification["type"]) => {
  if (type === "challenge_completed") return Trophy;
  if (type === "milestone_unlocked") return Mountain;
  if (type === "strava_reconnect") return AlertTriangle;
  return Bell;
};

export const NotificationBell = () => {
  const unread = useUnreadCount();
  const list = useUserNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const count = unread.data ?? 0;
  const items = (list.data ?? []).slice(0, 8);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-navy transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {count > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            items.map((n) => {
              const Icon = iconFor(n.type);
              const inner = (
                <div className={`flex gap-3 px-3 py-3 transition hover:bg-muted ${!n.read_at ? "bg-primary/5" : ""}`}>
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{n.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read_at && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                </div>
              );
              return n.link_url ? (
                <Link
                  key={n.id}
                  to={n.link_url}
                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                  className="block"
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                  className="block w-full text-left"
                >
                  {inner}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t px-3 py-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications">View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
