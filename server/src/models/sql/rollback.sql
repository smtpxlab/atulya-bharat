-- =============================================================================
--  server/src/models/sql/rollback.sql
-- =============================================================================
--  Full rollback of migration 004 (schema import). Drops the entire public
--  schema and recreates it empty. Enums, sequences, and extensions from
--  earlier migrations are cleaned up by their own `down()` steps.
--
--  Ordered strategy — safest and deterministic:
--    1. Drop the `public` schema CASCADE (removes tables, indexes, functions,
--       triggers, sequences owned by it).
--    2. Recreate an empty `public` schema owned by the current user.
--    3. Re-grant baseline USAGE to `app` so subsequent migrations don't fail.
--
--  This is destructive by design — pair with a database snapshot in production.
-- =============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app') THEN
    GRANT USAGE ON SCHEMA public TO app;
  END IF;
END $$;
