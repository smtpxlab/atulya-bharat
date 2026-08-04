/**
 * Express re-implementations of the admin RPCs:
 * admin_booking_stats, admin_challenge_participant_stats,
 * admin_list_challenge_participants, admin_force_complete_registration.
 *
 * The admin check happens in middleware / the RPC gate — these functions
 * assume the caller is already authorized.
 */
import type { Knex } from "knex";
import { getDb } from "../../config/db";
import { HttpError } from "../../utils/httpError";
import { progressByRegistration, registrationLoggedKm } from "../challenges/progress.service";

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const round = (v: number, d: number) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

export type BookingStats = {
  bookings_total: number;
  paid_count: number;
  pending_count: number;
  failed_count: number;
  refunded_count: number;
  revenue_paise: number;
  paid_amount_paise: number;
  pending_amount_paise: number;
  refunded_amount_paise: number;
  registered_users: number;
};

/** Mirrors public.admin_booking_stats(_challenge_id) — challenge id optional. */
export async function adminBookingStats(
  challengeId: string | null = null,
  db: Knex = getDb(),
): Promise<BookingStats> {
  const qb = db("orders").select(
    db.raw("count(*)::int as bookings_total"),
    db.raw("count(*) filter (where payment_status = 'paid')::int as paid_count"),
    db.raw("count(*) filter (where payment_status = 'pending')::int as pending_count"),
    db.raw("count(*) filter (where payment_status = 'failed')::int as failed_count"),
    db.raw("count(*) filter (where payment_status = 'refunded')::int as refunded_count"),
    db.raw(
      "coalesce(sum(final_amount_paise) filter (where payment_status = 'paid'), 0)::bigint as paid_amount_paise",
    ),
    db.raw(
      "coalesce(sum(final_amount_paise) filter (where payment_status = 'pending'), 0)::bigint as pending_amount_paise",
    ),
    db.raw(
      "coalesce(sum(final_amount_paise) filter (where payment_status = 'refunded'), 0)::bigint as refunded_amount_paise",
    ),
    db.raw(
      "count(distinct user_id) filter (where payment_status = 'paid')::int as registered_users",
    ),
  );
  if (challengeId) qb.where({ challenge_id: challengeId });
  const [row] = await qb;
  const paid = num((row as any)?.paid_amount_paise);
  return {
    bookings_total: num((row as any)?.bookings_total),
    paid_count: num((row as any)?.paid_count),
    pending_count: num((row as any)?.pending_count),
    failed_count: num((row as any)?.failed_count),
    refunded_count: num((row as any)?.refunded_count),
    revenue_paise: paid,
    paid_amount_paise: paid,
    pending_amount_paise: num((row as any)?.pending_amount_paise),
    refunded_amount_paise: num((row as any)?.refunded_amount_paise),
    registered_users: num((row as any)?.registered_users),
  };
}

export type ParticipantStats = {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  expired: number;
  total_distance_km: number;
  completion_rate: number;
};

/** Mirrors public.admin_challenge_participant_stats(_challenge_id). */
export async function adminChallengeParticipantStats(
  challengeId: string,
  db: Knex = getDb(),
): Promise<ParticipantStats> {
  const [row] = await db("registrations")
    .where({ challenge_id: challengeId })
    .select(
      db.raw("count(*)::int as total"),
      db.raw("count(*) filter (where status = 'active')::int as active"),
      db.raw("count(*) filter (where status = 'completed')::int as completed"),
      db.raw("count(*) filter (where status = 'cancelled')::int as cancelled"),
      db.raw("count(*) filter (where status = 'expired')::int as expired"),
    );

  const regs = await db("registrations").where({ challenge_id: challengeId }).select("id");
  let km = 0;
  for (const r of regs as any[]) km += await registrationLoggedKm(r.id, db);

  const total = num((row as any)?.total);
  const completed = num((row as any)?.completed);
  return {
    total,
    active: num((row as any)?.active),
    completed,
    cancelled: num((row as any)?.cancelled),
    expired: num((row as any)?.expired),
    total_distance_km: round(km, 2),
    completion_rate: total > 0 ? round((completed / total) * 100, 1) : 0,
  };
}

export type ParticipantRow = Record<string, unknown> & { registration_id: string; total_count: number };

/** Mirrors public.admin_list_challenge_participants(...). */
export async function adminListChallengeParticipants(
  challengeId: string,
  opts: { search?: string | null; status?: string | null; limit?: number; offset?: number } = {},
  db: Knex = getDb(),
): Promise<ParticipantRow[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const offset = Math.max(0, opts.offset ?? 0);
  const search = (opts.search ?? "").trim();
  const status = opts.status ?? null;

  const base = () => {
    const qb = db("registrations as r")
      .join("profiles as p", "p.id", "r.user_id")
      .where("r.challenge_id", challengeId);
    if (status && status !== "all") qb.andWhereRaw("r.status::text = ?", [status]);
    if (search) {
      qb.andWhere((w) =>
        w
          .whereILike("p.full_name", `%${search}%`)
          .orWhereILike("p.email", `%${search}%`)
          .orWhereILike("r.bib_number", `%${search}%`),
      );
    }
    return qb;
  };

  const [countRow] = await base().count<{ count: string }[]>("* as count");
  const total = num((countRow as any)?.count);

  const rows = (await base()
    .orderBy("r.registered_at", "desc")
    .limit(limit)
    .offset(offset)
    .select(
      "r.id as registration_id",
      "r.user_id",
      "p.full_name",
      "p.email",
      "p.avatar_url",
      "r.bib_number",
      "r.registered_at",
      db.raw("r.status::text as status"),
      "r.completed_at",
      "r.certificate_number",
      db.raw("coalesce(r.activity_mode::text, 'any') as activity_mode"),
    )) as any[];

  if (!rows.length) return [];

  const orderResult = await db.raw(
    `select distinct on (o.registration_id)
            o.registration_id, o.id as order_id, o.booking_number,
            o.payment_status, o.final_amount_paise
       from public.orders o
      where o.registration_id = any(?)
      order by o.registration_id, (o.payment_status = 'paid') desc, o.created_at desc`,
    [rows.map((r) => r.registration_id)],
  );
  const orders = new Map<string, any>(
    (((orderResult as any).rows ?? orderResult) as any[]).map((o) => [o.registration_id, o]),
  );

  const out: ParticipantRow[] = [];
  for (const r of rows) {
    const o = orders.get(r.registration_id);
    const prog = await progressByRegistration(r.registration_id, db);
    out.push({
      registration_id: r.registration_id,
      user_id: r.user_id,
      full_name: r.full_name,
      email: r.email,
      avatar_url: r.avatar_url,
      booking_number: o?.booking_number ?? r.bib_number ?? null,
      registered_at: r.registered_at,
      status: r.status,
      completed_at: r.completed_at,
      certificate_number: r.certificate_number,
      payment_status: o?.payment_status ?? "unknown",
      order_id: o?.order_id ?? null,
      amount_paise: o?.final_amount_paise ?? null,
      activity_mode: r.activity_mode,
      distance_target_km: prog?.distance_target_km ?? 0,
      distance_logged_km: prog?.distance_logged_km ?? 0,
      distance_remaining_km: prog?.distance_remaining_km ?? 0,
      pct_complete: prog?.pct_complete ?? 0,
      activities_count: prog?.activities_count ?? 0,
      milestones_total: prog?.milestones_total ?? 0,
      milestones_unlocked: prog?.milestones_unlocked ?? 0,
      total_count: total,
    });
  }
  return out;
}

export type ForceCompleteResult = {
  ok: true;
  registration_id: string;
  log_id: string | null;
  added_km: number;
  milestones_unlocked: number;
};

/** Mirrors public.admin_force_complete_registration(_registration_id). */
export async function adminForceCompleteRegistration(
  registrationId: string,
  dbArg: Knex = getDb(),
): Promise<ForceCompleteResult> {
  return dbArg.transaction(async (trx) => {
    const reg = await trx("registrations as r")
      .join("challenges as c", "c.id", "r.challenge_id")
      .where("r.id", registrationId)
      .first<any>(
        "r.id",
        "r.user_id",
        "r.challenge_id",
        trx.raw("r.status::text as status"),
        trx.raw("coalesce(r.activity_mode::text, 'any') as mode"),
        trx.raw("coalesce(c.distance, 0) as target"),
      );
    if (!reg) throw HttpError.notFound("Registration not found.");

    // Serialise against manual/Strava writes for the same registration.
    await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [`strava-reg:${reg.id}`]);

    const target = num(reg.target);
    const activityType = reg.mode === "walk" ? "Walk" : reg.mode === "ride" ? "Ride" : "Run";
    const loggedBefore = await registrationLoggedKm(reg.id, trx);
    const remaining = Math.max(0, round(target - loggedBefore, 3));

    let logId: string | null = null;
    if (remaining > 0) {
      const [log] = await trx("activity_logs")
        .insert({
          user_id: reg.user_id,
          registration_id: reg.id,
          source: "manual",
          distance_km: remaining,
          activity_date: trx.raw("current_date"),
          activity_type: activityType,
          sport_type: activityType,
          raw_payload: JSON.stringify({ notes: "Admin force-complete", admin: true }),
        })
        .returning("id");
      logId = (log as any)?.id ?? null;
    }

    const loggedAfter = await registrationLoggedKm(reg.id, trx);
    await trx("registrations")
      .where({ id: reg.id })
      .update({
        total_km_logged: Math.max(target, loggedAfter),
        status: "completed",
        completed_at: trx.raw("coalesce(completed_at, now())"),
      });

    const unlockResult = await trx.raw(
      `insert into public.user_milestones (user_id, milestone_id, registration_id, km_at_unlock)
       select ?, cm.id, ?, ?
         from public.challenge_milestones cm
        where cm.challenge_id = ?
          and cm.distance <= ?
          and not exists (
            select 1 from public.user_milestones um
             where um.registration_id = ? and um.milestone_id = cm.id
          )
       returning milestone_id`,
      [reg.user_id, reg.id, target, reg.challenge_id, target, reg.id],
    );

    return {
      ok: true as const,
      registration_id: reg.id,
      log_id: logId,
      added_km: remaining,
      milestones_unlocked: (((unlockResult as any).rows ?? unlockResult) as any[]).length,
    };
  });
}
