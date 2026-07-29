import { supabase } from "@/integrations/supabase/client";

export type AdminParticipantRow = {
  registration_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  booking_number: string | null;
  registered_at: string;
  status: string;
  completed_at: string | null;
  certificate_number: string | null;
  payment_status: string;
  order_id: string | null;
  amount_paise: number | null;
  activity_mode: string;
  distance_target_km: number;
  distance_logged_km: number;
  distance_remaining_km: number;
  pct_complete: number;
  activities_count: number;
  milestones_total: number;
  milestones_unlocked: number;
};

export type AdminParticipantStats = {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  expired: number;
  total_distance_km: number;
  completion_rate: number;
};

export const adminParticipantsService = {
  async list(params: {
    challengeId: string;
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: AdminParticipantRow[]; total: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const { data, error } = await supabase.rpc(
      "admin_list_challenge_participants" as never,
      {
        _challenge_id: params.challengeId,
        _search: params.search ?? null,
        _status: params.status && params.status !== "all" ? params.status : null,
        _limit: pageSize,
        _offset: (page - 1) * pageSize,
      } as never,
    );
    if (error) throw error;
    const rows = (data as any[]) ?? [];
    const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;
    const items: AdminParticipantRow[] = rows.map((r: any) => ({
      registration_id: r.registration_id,
      user_id: r.user_id,
      full_name: r.full_name ?? null,
      email: r.email ?? null,
      avatar_url: r.avatar_url ?? null,
      booking_number: r.booking_number ?? null,
      registered_at: r.registered_at,
      status: r.status,
      completed_at: r.completed_at ?? null,
      certificate_number: r.certificate_number ?? null,
      payment_status: r.payment_status ?? "unknown",
      order_id: r.order_id ?? null,
      amount_paise: r.amount_paise ?? null,
      activity_mode: r.activity_mode ?? "any",
      distance_target_km: Number(r.distance_target_km ?? 0),
      distance_logged_km: Number(r.distance_logged_km ?? 0),
      distance_remaining_km: Number(r.distance_remaining_km ?? 0),
      pct_complete: Number(r.pct_complete ?? 0),
      activities_count: Number(r.activities_count ?? 0),
      milestones_total: Number(r.milestones_total ?? 0),
      milestones_unlocked: Number(r.milestones_unlocked ?? 0),
    }));
    return { items, total };
  },

  async stats(challengeId: string): Promise<AdminParticipantStats> {
    const { data, error } = await supabase.rpc(
      "admin_challenge_participant_stats" as never,
      { _challenge_id: challengeId } as never,
    );
    if (error) throw error;
    const s = (data as any) ?? {};
    return {
      total: Number(s.total ?? 0),
      active: Number(s.active ?? 0),
      completed: Number(s.completed ?? 0),
      cancelled: Number(s.cancelled ?? 0),
      expired: Number(s.expired ?? 0),
      total_distance_km: Number(s.total_distance_km ?? 0),
      completion_rate: Number(s.completion_rate ?? 0),
    };
  },
};
