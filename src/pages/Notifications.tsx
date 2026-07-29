import { Link, Navigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Mountain, Trophy, AlertTriangle, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  useUserNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useUnreadCount,
} from "@/features/notifications/hooks/useUserNotifications";
import type { UserNotification } from "@/services/userNotifications.service";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/SEO";

const iconFor = (type: UserNotification["type"]) => {
  if (type === "challenge_completed") return Trophy;
  if (type === "milestone_unlocked") return Mountain;
  if (type === "strava_reconnect") return AlertTriangle;
  return Bell;
};

const Notifications = () => {
  const { user } = useAuth();
  const list = useUserNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (!user) return <Navigate to="/login" replace />;

  const items = list.data ?? [];

  return (
    <main className="abr-container py-8 md:py-10">
      <SEO title="Notifications | Atulya Bharat Run" noindex />
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link to="/dashboard" className="inline-flex items-center text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" /> Dashboard
        </Link>
      </div>

      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {(unread.data ?? 0) > 0
              ? `${unread.data} unread`
              : "You're all caught up."}
          </p>
        </div>
        {(unread.data ?? 0) > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
            <Check className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {list.isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const Icon = iconFor(n.type);
              const inner = (
                <div className={`flex gap-3 p-4 transition hover:bg-muted ${!n.read_at ? "bg-primary/5" : ""}`}>
                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read_at && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link_url ? (
                    <Link to={n.link_url} onClick={() => !n.read_at && markRead.mutate(n.id)} className="block">
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => !n.read_at && markRead.mutate(n.id)}
                      className="block w-full text-left"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
};

export default Notifications;
