export type NewsletterStatus = "subscribed" | "unsubscribed";

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: NewsletterStatus;
  source: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsletterListParams {
  search?: string;
  status?: "all" | NewsletterStatus;
  page?: number;
  pageSize?: number;
}

export interface NewsletterListResult {
  rows: NewsletterSubscriber[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NewsletterStats {
  total: number;
  active: number;
  unsubscribed: number;
  last30Days: number;
}

export type SubscribeResult =
  | { ok: true; reactivated?: boolean; message: string }
  | { ok: false; duplicate?: boolean; invalid?: boolean; message: string };
