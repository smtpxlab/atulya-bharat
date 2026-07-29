import { supabase } from "@/integrations/supabase/client";
import type {
  Notification,
  NotificationFormData,
  NotificationListParams,
  NotificationListResult,
} from "@/types/notification";

const TABLE = "notifications" as const;

function mapError(error: { message: string }): Error {
  return new Error(error.message);
}

function normalize(input: NotificationFormData): NotificationFormData {
  return {
    title: input.title.trim(),
    message: input.message.trim(),
    status: input.status,
  };
}

export const notificationService = {
  async listAdmin(params: NotificationListParams = {}): Promise<NotificationListResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from(TABLE)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    const search = params.search?.trim();
    if (search) {
      query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw mapError(error);
    return {
      rows: (data ?? []) as unknown as Notification[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  async getById(id: string): Promise<Notification> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw mapError(error);
    if (!data) throw new Error("Notification not found");
    return data as unknown as Notification;
  },

  async create(input: NotificationFormData): Promise<Notification> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(normalize(input) as never)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Notification;
  },

  async update(id: string, input: NotificationFormData): Promise<Notification> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(normalize(input) as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Notification;
  },

  async remove(id: string): Promise<{ id: string }> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw mapError(error);
    return { id };
  },

  async setPublished(id: string, is_published: boolean): Promise<Notification> {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ is_published } as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as Notification;
  },

  /**
   * Future frontend integration — not yet wired to any UI.
   * Returns notifications that are enabled AND published.
   */
  async getActiveNotifications(): Promise<Notification[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("status", true)
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    if (error) throw mapError(error);
    return (data ?? []) as unknown as Notification[];
  },
};
