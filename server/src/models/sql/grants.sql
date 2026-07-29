-- =============================================================================
--  server/src/models/sql/grants.sql
-- =============================================================================
--  GRANT statements for Railway PostgreSQL.
--
--  Supabase relies on PostgREST-level roles (`anon`, `authenticated`,
--  `service_role`). On Railway the API talks to Postgres directly with a
--  single application role, so those PostgREST-tier grants are not required.
--
--  Convention adopted for this project:
--    * All migrations run as the Railway `postgres` superuser (owner).
--    * The API service connects as role `app` (created below), member of no
--      privileged roles. It receives table-level DML on public.*.
--    * The worker service reuses the same `app` role.
--
--  DO NOT hand-edit — regenerate with `npm run schema:dump` (the dumper
--  enumerates public tables at dump time so new tables are picked up
--  automatically).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app LOGIN NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app;

-- Table + sequence grants: applied to every public.* object that exists at
-- migration time. The `schema.sql` dump appends a per-table GRANT block after
-- each CREATE TABLE, so this file is intentionally the fallback for anything
-- created by ad-hoc migrations later.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app;
