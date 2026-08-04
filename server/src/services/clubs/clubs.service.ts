/**
 * Express re-implementations of the club Postgres functions:
 * list_public_clubs, get_public_club_by_slug, list_club_members,
 * recompute_club_member_count.
 *
 * Visibility rules that used to rely on auth.uid() are enforced here with the
 * caller identity passed in explicitly.
 */
import type { Knex } from "knex";
import { getDb } from "../../config/db";

export const CLUB_PUBLIC_COLS = [
  "id",
  "slug",
  "name",
  "club_type",
  "description",
  "logo_url",
  "banner_url",
  "promoter_id",
  "promoter_name",
  "promoter_city",
  "promoter_state",
  "promoter_description",
  "established_at",
  "discount_challenge_percent",
  "discount_cart_percent",
  "social_links",
  "tags",
  "is_public",
  "status",
  "priority",
  "member_count",
  "category_id",
  "created_by",
  "created_at",
  "updated_at",
  "meta_title",
  "meta_description",
  "meta_keywords",
];

/** Mirrors public.list_public_clubs(). */
export async function listPublicClubs(db: Knex = getDb()) {
  return db("clubs")
    .select(CLUB_PUBLIC_COLS)
    .where({ status: "approved", is_public: true })
    .orderBy("priority", "desc")
    .orderBy("created_at", "desc");
}

/** Mirrors public.get_public_club_by_slug(_slug). */
export async function getPublicClubBySlug(slug: string, db: Knex = getDb()) {
  const row = await db("clubs")
    .select(CLUB_PUBLIC_COLS)
    .where({ slug, status: "approved", is_public: true })
    .first();
  return row ?? null;
}

export async function isClubMember(userId: string | null | undefined, clubId: string, db: Knex = getDb()) {
  if (!userId) return false;
  const row = await db("club_members").where({ club_id: clubId, user_id: userId }).first("id");
  return Boolean(row);
}

/** Reproduces the visibility predicate inside list_club_members. */
export async function canSeeClubMembers(
  clubId: string,
  userId: string | null | undefined,
  isAdmin: boolean,
  db: Knex = getDb(),
): Promise<boolean> {
  const club = await db("clubs")
    .where({ id: clubId })
    .first<{ status: string; is_public: boolean; promoter_id: string | null; created_by: string | null } | undefined>(
      "status",
      "is_public",
      "promoter_id",
      "created_by",
    );
  if (!club) return false;
  if (club.status === "approved" && club.is_public) return true;
  if (isAdmin) return true;
  if (userId && (club.promoter_id === userId || club.created_by === userId)) return true;
  return isClubMember(userId, clubId, db);
}

export type ClubMemberRow = {
  membership_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  is_owner: boolean;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  activities_count: number;
  total_distance_km: number;
  challenges_completed: number;
};

/** Mirrors public.list_club_members(_club_id) — visibility checked by the caller. */
export async function listClubMembers(clubId: string, db: Knex = getDb()): Promise<ClubMemberRow[]> {
  const result = await db.raw(
    `with acts as (
        select a.user_id, count(*)::int as n, coalesce(sum(a.distance_km), 0)::numeric as km
          from public.activity_logs a
          join public.club_members m on m.user_id = a.user_id
         where m.club_id = ?
         group by a.user_id
      ),
      done as (
        select r.user_id, count(*)::int as n
          from public.registrations r
          join public.club_members m on m.user_id = r.user_id
         where m.club_id = ? and r.status = 'completed'
         group by r.user_id
      )
      select cm.id as membership_id, cm.user_id, cm.role::text as role, cm.joined_at,
             (cm.role::text = 'owner') as is_owner,
             p.full_name, p.avatar_url, p.city,
             coalesce(acts.n, 0) as activities_count,
             round(coalesce(acts.km, 0), 2) as total_distance_km,
             coalesce(done.n, 0) as challenges_completed
        from public.club_members cm
        join public.profiles p on p.id = cm.user_id
        left join acts on acts.user_id = cm.user_id
        left join done on done.user_id = cm.user_id
       where cm.club_id = ?
       order by (cm.role::text = 'owner') desc, (cm.role::text = 'admin') desc, cm.joined_at asc`,
    [clubId, clubId, clubId],
  );
  return (((result as any).rows ?? result) as any[]).map((r) => ({
    ...r,
    activities_count: Number(r.activities_count ?? 0),
    total_distance_km: Number(r.total_distance_km ?? 0),
    challenges_completed: Number(r.challenges_completed ?? 0),
    is_owner: Boolean(r.is_owner),
  }));
}

/** Mirrors public.recompute_club_member_count — returns rows corrected. */
export async function recomputeClubMemberCount(
  clubId: string | null = null,
  db: Knex = getDb(),
): Promise<number> {
  const result = await db.raw(
    `with counts as (
        select c.id,
               coalesce((select count(*) from public.club_members m where m.club_id = c.id), 0)::int as actual
          from public.clubs c
         where ?::uuid is null or c.id = ?::uuid
      )
      update public.clubs c set member_count = counts.actual
        from counts
       where c.id = counts.id and c.member_count <> counts.actual
      returning c.id`,
    [clubId, clubId],
  );
  return (((result as any).rows ?? result) as any[]).length;
}
