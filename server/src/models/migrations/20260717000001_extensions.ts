/**
 * Migration 001 — PostgreSQL extensions.
 *
 * Enables the extensions the source schema relies on:
 *   - pgcrypto:  gen_random_uuid(), digest(), hmac()
 *   - citext:    used by newsletter_subscribers.email
 *   - unaccent:  full-text helpers used in blog/gallery searches (safe no-op if unused)
 *   - pg_trgm:   trigram indexes on club/blog search
 *
 * All are idempotent; safe to re-run.
 */
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "citext";`);
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "unaccent";`);
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
}

export async function down(knex: Knex): Promise<void> {
  // Extensions are shared cluster-wide; do not DROP on rollback to avoid
  // breaking sibling schemas. This is intentionally a no-op.
  await knex.raw(`SELECT 1;`);
}
