/**
 * Express re-implementations of public.global_leaderboard and public.hall_of_fame.
 * Both are read-only and public — no auth.uid() dependency.
 */
import type { Knex } from "knex";
import { getDb } from "../../config/db";

export type GlobalLeaderboardRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  km_this_month: number;
  km_all_time: number;
  challenges_completed: number;
};

export async function globalLeaderboard(
  limit = 20,
  offset = 0,
  db: Knex = getDb(),
): Promise<GlobalLeaderboardRow[]> {
  const result = await db.raw(
    `with monthly as (
        select user_id, sum(distance_km)::numeric as km
          from public.activity_logs
         where activity_date >= date_trunc('month', current_date)
         group by user_id
      ),
      alltime as (
        select user_id, sum(distance_km)::numeric as km
          from public.activity_logs group by user_id
      ),
      completed as (
        select user_id, count(*)::int as n
          from public.registrations where status = 'completed' group by user_id
      )
      select p.id as user_id, p.full_name, p.avatar_url, p.city,
             coalesce(m.km, 0) as km_this_month,
             coalesce(a.km, 0) as km_all_time,
             coalesce(c.n, 0) as challenges_completed
        from public.profiles p
        left join monthly m on m.user_id = p.id
        left join alltime a on a.user_id = p.id
        left join completed c on c.user_id = p.id
       where coalesce(a.km, 0) > 0
       order by coalesce(m.km, 0) desc, coalesce(a.km, 0) desc
       limit ? offset ?`,
    [limit, offset],
  );
  return (((result as any).rows ?? result) as any[]).map((r) => ({
    ...r,
    km_this_month: Number(r.km_this_month ?? 0),
    km_all_time: Number(r.km_all_time ?? 0),
    challenges_completed: Number(r.challenges_completed ?? 0),
  }));
}

export type HallOfFameRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  challenge_id: string;
  challenge_name: string;
  challenge_slug: string;
  unlocked_at: string;
};

/** Users who unlocked the final milestone of a challenge, newest first. */
export async function hallOfFame(limit = 50, db: Knex = getDb()): Promise<HallOfFameRow[]> {
  const result = await db.raw(
    `with last_ms as (
        select distinct on (challenge_id) id, challenge_id, sort_order
          from public.challenge_milestones
         order by challenge_id, sort_order desc nulls last
      )
      select um.user_id, p.full_name, p.avatar_url,
             c.id as challenge_id, c.name as challenge_name, c.slug as challenge_slug,
             um.unlocked_at
        from public.user_milestones um
        join last_ms lm on lm.id = um.milestone_id
        join public.challenges c on c.id = lm.challenge_id
        join public.profiles p on p.id = um.user_id
       order by um.unlocked_at desc
       limit ?`,
    [limit],
  );
  return ((result as any).rows ?? result) as HallOfFameRow[];
}
