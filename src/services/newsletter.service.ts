import { supabase } from "@/integrations/supabase/client";
import type {
  NewsletterListParams,
  NewsletterListResult,
  NewsletterStats,
  NewsletterSubscriber,
  SubscribeResult,
} from "@/types/newsletter";

const TABLE = "newsletter_subscribers" as const;

function mapError(error: { message: string }): Error {
  return new Error(error.message);
}

export const newsletterService = {
  async subscribe(email: string, source?: string): Promise<SubscribeResult> {
    const { data, error } = await supabase.rpc("subscribe_to_newsletter" as never, {
      _email: email,
      _source: source ?? null,
    } as never);

    if (error) {
      return { ok: false, message: error.message };
    }

    const status = (data as { status?: string } | null)?.status;
    switch (status) {
      case "subscribed":
        return { ok: true, message: "Thanks for subscribing to Atulya Bharat Run updates." };
      case "reactivated":
        return {
          ok: true,
          reactivated: true,
          message: "Welcome back! Your subscription has been reactivated.",
        };
      case "duplicate":
        return { ok: false, duplicate: true, message: "You're already subscribed." };
      case "invalid":
        return { ok: false, invalid: true, message: "Please enter a valid email." };
      default:
        return { ok: false, message: "Something went wrong. Please try again." };
    }
  },

  async listAdmin(params: NewsletterListParams = {}): Promise<NewsletterListResult> {
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
    if (search) query = query.ilike("email", `%${search}%`);
    if (params.status && params.status !== "all") query = query.eq("status", params.status);

    const { data, error, count } = await query;
    if (error) throw mapError(error);
    return {
      rows: (data ?? []) as unknown as NewsletterSubscriber[],
      total: count ?? 0,
      page,
      pageSize,
    };
  },

  async getStats(): Promise<NewsletterStats> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [totalRes, activeRes, unsubRes, last30Res] = await Promise.all([
      supabase.from(TABLE).select("id", { count: "exact", head: true }),
      supabase
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .eq("status", "subscribed"),
      supabase
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .eq("status", "unsubscribed"),
      supabase
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString()),
    ]);

    const err =
      totalRes.error || activeRes.error || unsubRes.error || last30Res.error;
    if (err) throw mapError(err);

    return {
      total: totalRes.count ?? 0,
      active: activeRes.count ?? 0,
      unsubscribed: unsubRes.count ?? 0,
      last30Days: last30Res.count ?? 0,
    };
  },

  async setStatus(id: string, status: "subscribed" | "unsubscribed"): Promise<NewsletterSubscriber> {
    const patch =
      status === "unsubscribed"
        ? { status, unsubscribed_at: new Date().toISOString() }
        : { status, unsubscribed_at: null, subscribed_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch as never)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw mapError(error);
    return data as unknown as NewsletterSubscriber;
  },

  async remove(id: string): Promise<{ id: string }> {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw mapError(error);
    return { id };
  },

  async exportAll(params: NewsletterListParams = {}): Promise<NewsletterSubscriber[]> {
    let query = supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    const search = params.search?.trim();
    if (search) query = query.ilike("email", `%${search}%`);
    if (params.status && params.status !== "all") query = query.eq("status", params.status);
    const { data, error } = await query;
    if (error) throw mapError(error);
    return (data ?? []) as unknown as NewsletterSubscriber[];
  },
};

export function subscribersToCsv(rows: NewsletterSubscriber[]): string {
  const headers = ["Email", "Status", "Source", "Subscribed At", "Unsubscribed At"];
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [r.email, r.status, r.source ?? "", r.subscribed_at, r.unsubscribed_at ?? ""]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
