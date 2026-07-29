/**
 * Seed placeholder. Phase 3 does NOT seed application data — no records are
 * migrated in this phase. The knex seeds directory exists so Phase 4+ can add
 * reference data (e.g. system role rows) via `knex seed:run`.
 */
import type { Knex } from "knex";

export async function seed(_knex: Knex): Promise<void> {
  // Intentionally empty. Data seeding lands in Phase 4+.
}
