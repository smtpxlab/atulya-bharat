/**
 * Migration 003 — Sequences.
 *
 * Recreates the three sequences used for human-readable identifiers:
 *   - orders_booking_seq            → AB-YYYY-NNNNNN booking numbers
 *   - registrations_bib_seq         → ABR-NNNNNN bib numbers
 *   - registrations_certificate_seq → certificate ids on completion
 */
import type { Knex } from "knex";

const SEQS = ["orders_booking_seq", "registrations_bib_seq", "registrations_certificate_seq"];

export async function up(knex: Knex): Promise<void> {
  for (const s of SEQS) {
    await knex.raw(`CREATE SEQUENCE IF NOT EXISTS public.${s} START 1 INCREMENT 1;`);
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const s of [...SEQS].reverse()) {
    await knex.raw(`DROP SEQUENCE IF EXISTS public.${s} CASCADE;`);
  }
}
