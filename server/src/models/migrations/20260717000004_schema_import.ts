/**
 * Migration 004 — Tables, indexes, constraints, functions, triggers.
 *
 * Instead of hand-rewriting 28 tables / 40+ functions / dozens of triggers as
 * Knex schema-builder chains (which introduces transcription drift), this
 * migration executes the canonical DDL slice-by-slice from `src/models/sql/`.
 *
 * Files (all pure PostgreSQL, produced by `scripts/dump-source-schema.ts`):
 *   1. tables.sql     — CREATE TABLE public.<name> (...) for every table
 *                       (columns, defaults, NOT NULLs, PK/UNIQUE/CHECK constraints,
 *                       FKs — auth.users FKs are rewritten to public.profiles
 *                       during dump, since auth.users lives outside our schema)
 *   2. indexes.sql    — CREATE INDEX / CREATE UNIQUE INDEX for every index
 *   3. functions.sql  — CREATE OR REPLACE FUNCTION for every public.* routine
 *   4. triggers.sql   — CREATE TRIGGER for every trigger
 *   5. grants.sql     — GRANT statements for the `app` role (Railway equivalent
 *                       of Supabase's `authenticated` grants)
 *
 * Running the migration on a fresh database produces a schema byte-identical
 * to the source (verified by `scripts/validate-schema.ts`).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Knex } from "knex";

const SQL_DIR = path.join(__dirname, "..", "sql");

const FILES = ["tables.sql", "indexes.sql", "functions.sql", "triggers.sql", "grants.sql"];

async function loadSql(file: string): Promise<string> {
  const p = path.join(SQL_DIR, file);
  return fs.readFile(p, "utf8");
}

export async function up(knex: Knex): Promise<void> {
  for (const file of FILES) {
    const sql = await loadSql(file);
    if (!sql.trim()) {
      // Allow empty slices in dev before the dump is generated; the CI/deploy
      // path fails the validate step if any critical slice is empty.
      continue;
    }
    await knex.raw(sql);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Down = the rollback script authored alongside this migration.
  const sql = await loadSql("rollback.sql");
  if (sql.trim()) await knex.raw(sql);
}
