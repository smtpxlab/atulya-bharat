/**
 * Post-migration validator. Connects to `DATABASE_URL` (the Railway target)
 * and asserts the inventory matches the source schema audit.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npm run schema:validate
 *
 * Exits non-zero on any missing object.
 */
import { Client } from "pg";

// Inventory captured from source Supabase (Phase 3 audit).
const EXPECTED_ENUMS = [
  "activity_mode",
  "activity_source",
  "app_role",
  "club_role",
  "media_type",
  "newsletter_status",
  "order_status",
  "registration_status",
];

const EXPECTED_TABLES = [
  "activity_logs",
  "blog_posts",
  "challenge_milestones",
  "challenge_tickets",
  "challenges",
  "club_members",
  "club_social_links",
  "clubs",
  "contact_enquiries",
  "coupons",
  "faqs",
  "gallery_images",
  "milestone_media",
  "newsletter_subscribers",
  "notifications",
  "orders",
  "pages",
  "payment_gateways",
  "profiles",
  "registrations",
  "strava_subscription_health",
  "strava_sync_runs",
  "strava_tokens",
  "strava_webhook_events",
  "testimonials",
  "user_milestones",
  "user_notifications",
  "user_roles",
];

const EXPECTED_SEQUENCES = [
  "orders_booking_seq",
  "registrations_bib_seq",
  "registrations_certificate_seq",
];

// A representative subset — full function list is validated by count.
const EXPECTED_FUNCTIONS_MIN = [
  "handle_new_user",
  "has_role",
  "is_admin",
  "is_super_admin",
  "get_user_roles",
  "is_club_member",
  "active_registration",
  "register_for_challenge",
  "cancel_active_registration",
  "expire_registrations",
  "challenge_progress",
  "challenge_leaderboard",
  "global_leaderboard",
  "log_manual_activity",
  "ingest_strava_activity",
  "ingest_strava_activities",
  "delete_strava_activity",
  "validate_coupon",
  "increment_coupon_usage",
  "list_public_clubs",
  "get_public_club_by_slug",
  "list_club_members",
  "admin_list_challenge_participants",
  "admin_challenge_participant_stats",
  "admin_booking_stats",
  "update_updated_at_column",
];

const MIN_FUNCTION_COUNT = 30;
const MIN_TRIGGER_COUNT = 15;
const MIN_INDEX_COUNT = 40;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const missing: string[] = [];
  const check = async (label: string, sql: string, params: unknown[], ok: (rows: unknown[]) => boolean) => {
    const res = await c.query(sql, params);
    if (!ok(res.rows)) missing.push(label);
  };

  // Enums
  for (const e of EXPECTED_ENUMS) {
    await check(
      `enum ${e}`,
      `SELECT 1 FROM pg_type WHERE typname=$1`,
      [e],
      (rows) => rows.length > 0,
    );
  }

  // Tables
  for (const t of EXPECTED_TABLES) {
    await check(
      `table public.${t}`,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [t],
      (rows) => rows.length > 0,
    );
  }

  // Sequences
  for (const s of EXPECTED_SEQUENCES) {
    await check(
      `sequence ${s}`,
      `SELECT 1 FROM information_schema.sequences WHERE sequence_schema='public' AND sequence_name=$1`,
      [s],
      (rows) => rows.length > 0,
    );
  }

  // Functions (representative subset)
  for (const f of EXPECTED_FUNCTIONS_MIN) {
    await check(
      `function public.${f}`,
      `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname='public' AND p.proname=$1`,
      [f],
      (rows) => rows.length > 0,
    );
  }

  // Counts
  const fnCount = (
    await c.query(
      `SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`,
    )
  ).rows[0].n as number;
  if (fnCount < MIN_FUNCTION_COUNT) missing.push(`function count ${fnCount} < ${MIN_FUNCTION_COUNT}`);

  const trigCount = (
    await c.query(
      `SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`,
    )
  ).rows[0].n as number;
  if (trigCount < MIN_TRIGGER_COUNT) missing.push(`trigger count ${trigCount} < ${MIN_TRIGGER_COUNT}`);

  const idxCount = (
    await c.query(`SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public'`)
  ).rows[0].n as number;
  if (idxCount < MIN_INDEX_COUNT) missing.push(`index count ${idxCount} < ${MIN_INDEX_COUNT}`);

  await c.end();

  if (missing.length) {
    console.error("Schema validation FAILED. Missing objects:");
    for (const m of missing) console.error("  -", m);
    process.exit(2);
  }
  console.log(
    `Schema OK — ${EXPECTED_TABLES.length} tables, ${EXPECTED_ENUMS.length} enums, ${fnCount} functions, ${trigCount} triggers, ${idxCount} indexes.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
