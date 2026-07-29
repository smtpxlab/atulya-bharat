# Database migrations — Phase 3

This directory contains the Knex-managed migration path from Supabase
PostgreSQL to Railway PostgreSQL. **Schema only** — no data is migrated in
this phase.

## Layout

```
src/models/
├── migrations/
│   ├── 20260717000001_extensions.ts     Enable pgcrypto, citext, unaccent, pg_trgm
│   ├── 20260717000002_enums.ts          Create 8 public enums
│   ├── 20260717000003_sequences.ts      Create 3 shared sequences
│   └── 20260717000004_schema_import.ts  Load SQL slices from src/models/sql/
├── sql/
│   ├── tables.sql       ← auto-generated: CREATE TABLE for every table
│   ├── indexes.sql      ← auto-generated: CREATE INDEX for every non-PK index
│   ├── functions.sql    ← auto-generated: CREATE OR REPLACE FUNCTION for all 40+ routines
│   ├── triggers.sql     ← auto-generated: CREATE TRIGGER for every trigger
│   ├── grants.sql       hand-authored: role `app` + baseline GRANTs
│   └── rollback.sql     hand-authored: DROP SCHEMA public CASCADE + recreate
└── seeds/
    └── 000_placeholder.ts   Empty — data seeding is Phase 4+
```

## One-time setup on a clean Railway PostgreSQL instance

```bash
cd server
cp .env.example .env
# Set DATABASE_URL to the Railway target, and SOURCE_DATABASE_URL to the
# source Supabase Postgres. SOURCE_* is only used for the dump step; the
# extractor is read-only.
export SOURCE_DATABASE_URL="postgres://<supabase>"
export DATABASE_URL="postgres://<railway>"

# 1. Extract schema from the source (read-only, no data copied)
npm run schema:dump

# 2. Run migrations against Railway
npm run migrate:latest

# 3. Validate that the destination schema matches the audit inventory
npm run schema:validate
```

Rollback the entire schema import in one command:

```bash
npm run migrate:rollback -- --step 4
```

## Design notes

- **auth.users boundary** — the source schema has a small number of FKs that
  point at Supabase's `auth.users(id)` table, which doesn't exist on Railway.
  The dumper rewrites those FKs to `public.profiles(id) ON DELETE SET NULL`
  during dump. This preserves referential integrity in the target because
  `profiles.id` is 1:1 with the user id everywhere it's used today.
- **`auth.uid()` shim** — many `SECURITY DEFINER` functions call `auth.uid()`.
  That function does not exist on Railway either. Phase 4's auth module
  installs a lightweight shim (`SET LOCAL auth.uid` + a SQL wrapper) so the
  functions run unchanged.
- **`SECURITY DEFINER`** — preserved as-is; the migration runs as `postgres`
  on Railway, so ownership is correct.
- **RLS policies are intentionally not migrated in Phase 3.** The Express
  API applies authorization in middleware (see `src/middleware/requireRole.ts`
  and the per-service policy checks landing in Phase 4). If we later need
  belt-and-suspenders RLS on Railway, we'll add a dedicated migration.
