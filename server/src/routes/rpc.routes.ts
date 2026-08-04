import { Router } from "express";
import { getDb } from "../config/db";
import { optionalAuth } from "../middleware/auth";
import { isAdmin } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import {
  activeRegistration,
  challengeLeaderboard,
  challengeProgress,
  logManualActivity,
  progressByRegistration,
} from "../services/challenges/progress.service";
import {
  cancelActiveRegistration,
  registerForChallenge,
} from "../services/challenges/registration.service";



/**
 * PostgREST-compatible RPC endpoint.
 *
 * The React app calls `supabase.rpc(fn, args)`, which the client shim turns
 * into `POST /rpc/:fn`. We execute the matching Postgres function with named
 * arguments. Self-hosted databases restored from the schema dump may not have
 * every function, so the most important ones (clubs) have a Knex fallback.
 */

type Access = "public" | "auth" | "admin";

const FUNCTIONS: Record<string, Access> = {
  list_public_clubs: "public",
  get_public_club_by_slug: "public",
  list_club_members: "public",
  global_leaderboard: "public",
  challenge_leaderboard: "public",
  hall_of_fame: "public",
  challenge_progress: "public",
  validate_coupon: "public",
  subscribe_to_newsletter: "public",
  active_registration: "auth",
  challenge_progress_by_registration: "auth",
  cancel_active_registration: "auth",
  log_manual_activity: "auth",
  last_strava_sync_run: "auth",
  recent_strava_sync_runs: "auth",
  increment_coupon_usage: "auth",
  register_for_challenge: "auth",
  admin_booking_stats: "admin",
  admin_challenge_participant_stats: "admin",
  admin_list_challenge_participants: "admin",
  admin_force_complete_registration: "admin",
  recompute_club_member_count: "admin",
};

const IDENT = /^[a-z0-9_]+$/i;

const CLUB_PUBLIC_COLS = [
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

/** Knex fallbacks used when the Postgres function does not exist (42883). */
const FALLBACKS: Record<string, (args: any) => Promise<unknown>> = {
  list_public_clubs: async () =>
    getDb()("clubs")
      .select(CLUB_PUBLIC_COLS)
      .where({ is_public: true, status: "approved" })
      .orderBy("priority", "desc")
      .orderBy("created_at", "desc"),

  get_public_club_by_slug: async (args) =>
    getDb()("clubs")
      .select(CLUB_PUBLIC_COLS)
      .where({ slug: String(args._slug ?? args.slug ?? "") })
      .limit(1),

  list_club_members: async (args) =>
    getDb()("club_members as cm")
      .leftJoin("profiles as p", "p.id", "cm.user_id")
      .where("cm.club_id", String(args._club_id ?? args.club_id ?? ""))
      .orderBy("cm.joined_at", "asc")
      .select(
        "cm.id as membership_id",
        "cm.user_id",
        "cm.role",
        "cm.joined_at",
        getDb().raw("(cm.role = 'owner') as is_owner"),
        "p.full_name",
        "p.avatar_url",
        "p.city",
        getDb().raw("0::int as activities_count"),
        getDb().raw("coalesce(p.total_km_logged, 0) as total_distance_km"),
        getDb().raw("coalesce(p.challenges_completed, 0) as challenges_completed"),
      ),
};

/**
 * Native Express implementations (Priority 1). These bypass Postgres functions
 * entirely — identity comes from the authenticated request, never auth.uid().
 */
const NATIVE: Record<
  string,
  (args: any, userId: string | undefined, roles: string[] | undefined) => Promise<unknown>
> = {
  active_registration: async (_args, userId) => {
    if (!userId) throw HttpError.unauthorized();
    // Always scoped to the caller — a supplied _user_id argument is ignored.
    const row = await activeRegistration(userId);
    return row ? [row] : [];
  },

  challenge_progress: async (args, userId) => {
    const uid = String(args._user_id ?? args.user_id ?? userId ?? "");
    const challengeId = String(args._challenge_id ?? args.challenge_id ?? "");
    if (!uid || !challengeId) throw HttpError.badRequest("user and challenge are required");
    const row = await challengeProgress(uid, challengeId);
    return row ? [row] : [];
  },
  challenge_progress_by_registration: async (args, userId, userRoles) => {
    if (!userId) throw HttpError.unauthorized();
    const regId = String(args._registration_id ?? args.registration_id ?? "");
    if (!regId) throw HttpError.badRequest("registration_id is required");
    const row = await progressByRegistration(regId);
    if (!row) return [];
    if (row.user_id !== userId && !isAdmin(userRoles)) throw HttpError.forbidden();
    return [row];
  },
  challenge_leaderboard: async (args) => {
    const challengeId = String(args._challenge_id ?? args.challenge_id ?? "");
    if (!challengeId) throw HttpError.badRequest("challenge_id is required");
    return challengeLeaderboard(
      challengeId,
      Math.min(Number(args._limit ?? args.limit ?? 20), 500),
      Math.max(Number(args._offset ?? args.offset ?? 0), 0),
    );
  },
  log_manual_activity: async (args, userId) => {
    if (!userId) throw HttpError.unauthorized();
    return logManualActivity(userId, {
      registration_id: String(args._registration_id ?? args.registration_id ?? ""),
      distance_km: Number(args._distance_km ?? args.distance_km),
      activity_date: String(args._activity_date ?? args.activity_date ?? ""),
      activity_type: String(args._activity_type ?? args.activity_type ?? ""),
      notes: (args._notes ?? args.notes ?? null) as string | null,
    });
  },
  register_for_challenge: async (args, userId) => {
    if (!userId) throw HttpError.unauthorized();
    // Identity always comes from the token; a supplied _user_id is ignored.
    return registerForChallenge(userId, {
      challenge_id: String(args._challenge_id ?? args.challenge_id ?? ""),
      ticket_id: (args._ticket_id ?? args.ticket_id ?? null) as string | null,
      activity_mode: (args._activity_mode ?? args.activity_mode ?? null) as string | null,
      target_days:
        args._target_days ?? args.target_days ? Number(args._target_days ?? args.target_days) : null,
    });
  },
  cancel_active_registration: async (args, userId) => {
    if (!userId) throw HttpError.unauthorized();
    return cancelActiveRegistration(
      userId,
      (args._registration_id ?? args.registration_id ?? null) as string | null,
    );
  },

};



const router = Router();

router.post(
  "/:fn",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const fn = req.params.fn;
    const access = FUNCTIONS[fn];
    if (!IDENT.test(fn) || !access) throw HttpError.notFound(`Unknown function '${fn}'`);
    if (access !== "public" && !req.user) throw HttpError.unauthorized();
    if (access === "admin" && !isAdmin(req.user?.roles)) {
      throw HttpError.forbidden("Insufficient role");
    }

    const args = (req.body ?? {}) as Record<string, unknown>;

    const native = NATIVE[fn];
    if (native) {
      return res.json(await native(args, req.user?.sub, req.user?.roles));
    }

    const names = Object.keys(args).filter((k) => IDENT.test(k));
    const placeholders = names.map((n) => `${n} := ?`).join(", ");
    const values = names.map((n) => args[n] as never);


    try {
      const result = await getDb().raw(
        `select * from public.${fn}(${placeholders})`,
        values,
      );
      const rows = (result as any).rows ?? result;
      // Scalar-returning functions come back as { fn: value } — unwrap them.
      if (Array.isArray(rows) && rows.length === 1) {
        const keys = Object.keys(rows[0] ?? {});
        if (keys.length === 1 && keys[0] === fn) {
          return res.json(rows[0][fn]);
        }
      }
      return res.json(rows);
    } catch (err: any) {
      const fallback = FALLBACKS[fn];
      if (fallback && (err?.code === "42883" || err?.code === "42P01")) {
        return res.json(await fallback(args));
      }
      throw err;
    }
  }),
);

export default router;
