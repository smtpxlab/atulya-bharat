/**
 * Express re-implementations of the Postgres functions that used to back the
 * challenge/activity endpoints (Priority 1 of the Railway migration).
 *
 * These deliberately avoid `auth.uid()` and any custom database function: the
 * caller's identity is always passed explicitly from the authenticated request,
 * so no session-local state leaks across pooled connections.
 */
import type { Knex } from "knex";
import { getDb } from "../../config/db";
import { HttpError } from "../../utils/httpError";

/** Mirrors public._activity_type_matches_mode. */
const MODE_TYPES: Record<string, string[]> = {
  run: ["run", "virtualrun", "trailrun"],
  walk: ["walk", "hike"],
  ride: ["ride", "virtualride", "ebikeride", "mountainbikeride", "gravelride", "cycling"],
};

export const allowedTypesForMode = (mode: string | null | undefined): string[] | null =>
  MODE_TYPES[(mode ?? "any").toLowerCase()] ?? null;

export const activityTypeMatchesMode = (
  activityType: string | null | undefined,
  mode: string | null | undefined,
): boolean => {
  const allowed = allowedTypesForMode(mode);
  if (!allowed) return true;
  return allowed.includes((activityType ?? "").toLowerCase());
};

/** SQL expression for a registration's effective window end (timestamptz). */
const WINDOW_END_SQL = `least(
  coalesce(c.end_at, 'infinity'::timestamptz),
  coalesce(r.registered_at + (r.target_days || ' days')::interval, 'infinity'::timestamptz),
  coalesce(r.registered_at + (c.max_duration_days || ' days')::interval, 'infinity'::timestamptz)
)`;

const WINDOW_START_SQL = `greatest(r.registered_at::date, coalesce(c.start_at::date, r.registered_at::date))`;

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const round = (v: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Mirrors public.expire_registrations — returns the number of rows expired. */
export async function expireRegistrations(userId?: string | null, db: Knex = getDb()) {
  const rows = await db.raw(
    `update public.registrations reg
        set status = 'expired'
      where reg.status = 'active'
        and (?::uuid is null or reg.user_id = ?::uuid)
        and exists (
          select 1 from public.challenges c
           where c.id = reg.challenge_id
             and (
               (c.end_at is not null and c.end_at < now())
               or (reg.target_days is not null and reg.registered_at + (reg.target_days || ' days')::interval < now())
               or (c.max_duration_days is not null and reg.registered_at + (c.max_duration_days || ' days')::interval < now())
             )
        )
      returning reg.id`,
    [userId ?? null, userId ?? null],
  );
  return ((rows as any).rows ?? rows ?? []).length as number;
}

export type ActiveRegistrationRow = {
  registration_id: string;
  challenge_id: string;
  challenge_name: string;
  challenge_slug: string;
  distance_target_km: number;
  activity_mode: string;
  registered_at: string | null;
  window_end: string | null;
  total_km_logged: number;
  cover_image_url: string | null;
};

/** Mirrors public.active_registration(_user_id). */
export async function activeRegistration(
  userId: string,
  db: Knex = getDb(),
): Promise<ActiveRegistrationRow | null> {
  await expireRegistrations(userId, db);
  const result = await db.raw(
    `select r.id as registration_id, c.id as challenge_id, c.name as challenge_name,
            c.slug as challenge_slug, c.distance as distance_target_km,
            coalesce(r.activity_mode::text, 'any') as activity_mode,
            r.registered_at,
            ${WINDOW_END_SQL} as window_end,
            r.total_km_logged, c.cover_image_url
       from public.registrations r
       join public.challenges c on c.id = r.challenge_id
      where r.user_id = ? and r.status = 'active'
      order by r.registered_at desc
      limit 1`,
    [userId],
  );
  const row = ((result as any).rows ?? result)[0];
  if (!row) return null;
  return {
    ...row,
    distance_target_km: num(row.distance_target_km),
    total_km_logged: num(row.total_km_logged),
  };
}

export type ProgressRow = {
  registration_id: string;
  challenge_id: string;
  user_id: string;
  distance_target_km: number;
  distance_logged_km: number;
  distance_remaining_km: number;
  pct_complete: number;
  activities_count: number;
  milestones_total: number;
  milestones_unlocked: number;
  is_complete: boolean;
  window_start: string | null;
  window_end: string | null;
  registered_at: string | null;
  activity_mode: string;
  first_activity_date: string | null;
  last_activity_date: string | null;
  days_left: number;
};

type RegContext = {
  id: string;
  user_id: string;
  challenge_id: string;
  status: string;
  registered_at: string;
  activity_mode: string;
  target: number;
  window_start: string;
  window_end_ts: string;
  window_end_date: string;
  days_left: number;
};

async function loadRegContext(
  registrationId: string,
  db: Knex,
): Promise<RegContext | null> {
  const result = await db.raw(
    `select r.id, r.user_id, r.challenge_id, r.status::text as status, r.registered_at,
            coalesce(r.activity_mode::text, 'any') as activity_mode,
            coalesce(c.distance, 0) as target,
            ${WINDOW_START_SQL} as window_start,
            ${WINDOW_END_SQL} as window_end_ts,
            least((${WINDOW_END_SQL})::date, current_date) as window_end_date,
            least(9999, greatest(0, (${WINDOW_END_SQL})::date - current_date))::int as days_left
       from public.registrations r
       join public.challenges c on c.id = r.challenge_id
      where r.id = ?`,
    [registrationId],
  );
  const row = ((result as any).rows ?? result)[0];
  if (!row) return null;
  return { ...row, target: num(row.target) } as RegContext;
}

/** Sum of in-window, mode-matching kilometres. Mirrors _registration_logged_km. */
export async function registrationLoggedKm(
  registrationId: string,
  db: Knex = getDb(),
): Promise<number> {
  const ctx = await loadRegContext(registrationId, db);
  if (!ctx) return 0;
  const allowed = allowedTypesForMode(ctx.activity_mode);
  const qb = db("activity_logs")
    .where({ registration_id: registrationId })
    .andWhereBetween("activity_date", [ctx.window_start, ctx.window_end_date]);
  if (allowed) {
    qb.andWhereRaw("lower(coalesce(sport_type, activity_type)) = any(?)", [allowed]);
  }
  const [row] = await qb.sum<{ km: string }[]>("distance_km as km");
  return num((row as any)?.km);
}

/** Mirrors public.challenge_progress_by_registration(_registration_id). */
export async function progressByRegistration(
  registrationId: string,
  db: Knex = getDb(),
): Promise<ProgressRow | null> {
  const ctx = await loadRegContext(registrationId, db);
  if (!ctx) return null;
  const allowed = allowedTypesForMode(ctx.activity_mode);

  const actsQb = db("activity_logs")
    .where({ registration_id: registrationId })
    .andWhereBetween("activity_date", [ctx.window_start, ctx.window_end_date]);
  if (allowed) {
    actsQb.andWhereRaw("lower(coalesce(sport_type, activity_type)) = any(?)", [allowed]);
  }
  const [agg] = await actsQb
    .clone()
    .select(
      db.raw("coalesce(sum(distance_km), 0) as km"),
      db.raw("count(*)::int as n"),
      db.raw("min(activity_date) as first_d"),
      db.raw("greatest(max(activity_date), max(start_date)::date) as last_d"),
    );

  const [msRow] = await db("challenge_milestones")
    .where({ challenge_id: ctx.challenge_id })
    .count<{ count: string }[]>("* as count");
  const [umsRow] = await db("user_milestones")
    .where({ registration_id: registrationId })
    .count<{ count: string }[]>("* as count");

  const km = num((agg as any)?.km);
  const target = ctx.target;
  const logged = round(target > 0 ? Math.min(km, target) : km, 3);

  return {
    registration_id: registrationId,
    challenge_id: ctx.challenge_id,
    user_id: ctx.user_id,
    distance_target_km: target,
    distance_logged_km: logged,
    distance_remaining_km: Math.max(0, round(target - km, 3)),
    pct_complete: target > 0 ? Math.min(100, round((km / target) * 100, 1)) : 0,
    activities_count: num((agg as any)?.n),
    milestones_total: num((msRow as any)?.count),
    milestones_unlocked: num((umsRow as any)?.count),
    is_complete: km >= target && target > 0 && ["active", "completed"].includes(ctx.status),
    window_start: ctx.window_start,
    window_end: ctx.window_end_date,
    registered_at: ctx.registered_at,
    activity_mode: ctx.activity_mode,
    first_activity_date: (agg as any)?.first_d ?? null,
    last_activity_date: (agg as any)?.last_d ?? null,
    days_left: num(ctx.days_left),
  };
}

/** Mirrors public.challenge_progress(_user_id, _challenge_id). */
export async function challengeProgress(
  userId: string,
  challengeId: string,
  db: Knex = getDb(),
): Promise<ProgressRow | null> {
  const reg = await db("registrations")
    .where({ user_id: userId, challenge_id: challengeId })
    .orderBy("registered_at", "desc")
    .first("id");
  if (!reg) return null;
  return progressByRegistration((reg as any).id, db);
}

export type LeaderboardRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  km_logged: number;
  pct_complete: number;
  activity_mode: string;
  milestones_unlocked: number;
};

/** Mirrors public.challenge_leaderboard(_challenge_id, _limit, _offset). */
export async function challengeLeaderboard(
  challengeId: string,
  limit = 20,
  offset = 0,
  db: Knex = getDb(),
): Promise<LeaderboardRow[]> {
  const result = await db.raw(
    `with ch as (select id, distance from public.challenges where id = ?),
     ms as (
       select um.user_id, count(*)::int as n
         from public.user_milestones um
         join public.challenge_milestones cm on cm.id = um.milestone_id
        where cm.challenge_id = ?
        group by um.user_id
     )
     select r.user_id, p.full_name, p.avatar_url,
            r.total_km_logged as km_logged,
            case when ch.distance > 0
                 then least(100, round(r.total_km_logged / ch.distance * 100, 1))
                 else 0 end as pct_complete,
            coalesce(r.activity_mode::text, 'any') as activity_mode,
            coalesce(ms.n, 0) as milestones_unlocked
       from public.registrations r
       join ch on true
       join public.profiles p on p.id = r.user_id
       left join ms on ms.user_id = r.user_id
      where r.challenge_id = ?
        and r.status in ('active', 'completed')
      order by r.total_km_logged desc
      limit ? offset ?`,
    [challengeId, challengeId, challengeId, limit, offset],
  );
  return (((result as any).rows ?? result) as any[]).map((r) => ({
    ...r,
    km_logged: num(r.km_logged),
    pct_complete: num(r.pct_complete),
    milestones_unlocked: num(r.milestones_unlocked),
  }));
}

export type ManualActivityInput = {
  registration_id: string;
  distance_km: number;
  activity_date: string;
  activity_type: string;
  notes?: string | null;
};

export type ManualActivityResult = {
  ok: true;
  log_id: string;
  registration_id: string;
  total_km_logged: number;
  completed: boolean;
  milestones_unlocked: number;
  newly_unlocked_milestone_ids: string[];
};

/**
 * Mirrors public.log_manual_activity, with the caller passed explicitly.
 * Runs in one transaction guarded by the same advisory lock key the Strava
 * importer uses, so concurrent manual + Strava writes cannot double-count.
 */
export async function logManualActivity(
  userId: string,
  input: ManualActivityInput,
  dbArg: Knex = getDb(),
): Promise<ManualActivityResult> {
  if (!userId) throw HttpError.unauthorized("Please sign in to log an activity.");
  if (!(input.distance_km > 0)) throw HttpError.badRequest("Distance must be greater than 0.");

  return dbArg.transaction(async (trx) => {
    const ctx = await loadRegContext(input.registration_id, trx);
    if (!ctx || ctx.user_id !== userId) throw HttpError.notFound("Registration not found.");
    if (ctx.status === "completed")
      throw HttpError.badRequest("You have already completed this challenge.");
    if (ctx.status !== "active") throw HttpError.badRequest("This challenge is not active.");
    if (!activityTypeMatchesMode(input.activity_type, ctx.activity_mode))
      throw HttpError.badRequest(`This challenge only accepts ${ctx.activity_mode} activities.`);
    if (ctx.target > 0 && input.distance_km > ctx.target)
      throw HttpError.badRequest(
        `A single activity cannot exceed the challenge target of ${ctx.target} km.`,
      );

    const windowStart = String(ctx.registered_at).slice(0, 10);
    const windowEnd = String(ctx.window_end_ts).slice(0, 10);
    if (input.activity_date < windowStart || input.activity_date > windowEnd)
      throw HttpError.badRequest(`Pick a date between ${windowStart} and ${windowEnd}.`);

    const dup = await trx("activity_logs")
      .where({
        registration_id: ctx.id,
        source: "manual",
        activity_date: input.activity_date,
      })
      .andWhereRaw("abs(distance_km - ?) <= 0.05", [input.distance_km])
      .first("id");
    if (dup) throw HttpError.badRequest("You already logged this exact distance for this date.");

    await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [`strava-reg:${ctx.id}`]);

    const [log] = await trx("activity_logs")
      .insert({
        user_id: userId,
        registration_id: ctx.id,
        source: "manual",
        distance_km: input.distance_km,
        activity_date: input.activity_date,
        activity_type: input.activity_type,
        raw_payload: input.notes ? JSON.stringify({ notes: input.notes }) : null,
      })
      .returning("id");

    const newTotal = await registrationLoggedKm(ctx.id, trx);
    const completed = ctx.target > 0 && newTotal >= ctx.target;
    await trx("registrations")
      .where({ id: ctx.id })
      .update(
        completed
          ? {
              total_km_logged: newTotal,
              status: "completed",
              completed_at: trx.raw("coalesce(completed_at, now())"),
            }
          : { total_km_logged: newTotal },
      );

    const unlockedResult = await trx.raw(
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
      [userId, ctx.id, newTotal, ctx.challenge_id, newTotal, ctx.id],
    );
    const unlockedIds = (((unlockedResult as any).rows ?? unlockedResult) as any[]).map(
      (r) => r.milestone_id as string,
    );

    return {
      ok: true as const,
      log_id: (log as any).id ?? log,
      registration_id: ctx.id,
      total_km_logged: newTotal,
      completed,
      milestones_unlocked: unlockedIds.length,
      newly_unlocked_milestone_ids: unlockedIds,
    };
  });
}
