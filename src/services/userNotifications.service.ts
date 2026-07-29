import { supabase } from "@/integrations/supabase/client";

export type UserNotification = {
  id: string;
  user_id: string;
  type: "challenge_completed" | "milestone_unlocked" | "strava_reconnect" | "generic";
  title: string;
  body: string;
  link_url: string | null;
  icon: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export const userNotificationsService = {
  async list(limit = 50): Promise<UserNotification[]> {
    const { data, error } = await supabase
      .from("user_notifications" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as UserNotification[];
  },

  async unreadCount(): Promise<number> {
    const { count, error } = await supabase
      .from("user_notifications" as any)
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    if (error) throw error;
    return count ?? 0;
  },

  async markRead(id: string) {
    const { error } = await supabase
      .from("user_notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
    if (error) throw error;
  },

  async markAllRead() {
    const { error } = await supabase
      .from("user_notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) throw error;
  },
};
