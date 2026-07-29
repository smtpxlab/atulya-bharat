/**
 * Migration 002 — Enums.
 *
 * Recreates every `public.<enum>` used by the source schema. Order matters:
 * enums must exist before the tables that reference them.
 *
 * Source of truth (extracted from Supabase, Phase 3):
 *   activity_mode        (run, walk, ride, any)
 *   activity_source      (strava, manual, abr_app)
 *   app_role             (admin, user, club_owner, content_manager, super_admin)
 *   club_role            (member, admin, owner)
 *   media_type           (image, audio, video)
 *   newsletter_status    (subscribed, unsubscribed)
 *   order_status         (created, paid, failed, refunded)
 *   registration_status  (pending_payment, active, completed, abandoned, expired, cancelled)
 */
import type { Knex } from "knex";

const ENUMS: Array<{ name: string; labels: string[] }> = [
  { name: "activity_mode", labels: ["run", "walk", "ride", "any"] },
  { name: "activity_source", labels: ["strava", "manual", "abr_app"] },
  { name: "app_role", labels: ["admin", "user", "club_owner", "content_manager", "super_admin"] },
  { name: "club_role", labels: ["member", "admin", "owner"] },
  { name: "media_type", labels: ["image", "audio", "video"] },
  { name: "newsletter_status", labels: ["subscribed", "unsubscribed"] },
  { name: "order_status", labels: ["created", "paid", "failed", "refunded"] },
  {
    name: "registration_status",
    labels: ["pending_payment", "active", "completed", "abandoned", "expired", "cancelled"],
  },
];

export async function up(knex: Knex): Promise<void> {
  for (const e of ENUMS) {
    const labels = e.labels.map((l) => `'${l}'`).join(", ");
    await knex.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e.name}') THEN
          CREATE TYPE public.${e.name} AS ENUM (${labels});
        END IF;
      END $$;
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Reverse order — enums are referenced by tables; if any table still exists
  // and holds a column of this type, DROP TYPE will fail (safe).
  for (const e of [...ENUMS].reverse()) {
    await knex.raw(`DROP TYPE IF EXISTS public.${e.name};`);
  }
}
