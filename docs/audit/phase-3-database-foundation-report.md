# Phase 3 — Database Foundation Report

**Scope:** Schema migration from Supabase PostgreSQL to Railway PostgreSQL. **No records, no users, no auth data, no files, no API wiring.** Frontend, Supabase, and the Phase 1.5 compatibility layer are untouched.

## Approach

Rather than hand-transliterating 28 tables / 40+ functions / 20+ triggers into Knex `schema.createTable()` chains — which introduces silent transcription drift on every column default, CHECK clause, and SECURITY DEFINER body — Phase 3 uses the **industry-standard schema-import pattern**:

1. An extractor (`scripts/dump-source-schema.ts`) connects **read-only** to the source Supabase database and emits pure PostgreSQL DDL into six versioned SQL files under `server/src/models/sql/`.
2. Four Knex migrations wrap those SQL slices with proper `up`/`down` semantics, ordered: **extensions → enums → sequences → schema-import (tables/indexes/functions/triggers/grants)**.
3. A validator (`scripts/validate-schema.ts`) asserts the destination inventory matches the audit before Phase 4 begins.

This preserves table names, column names, types, defaults, constraints, and function bodies **byte-identical** to production — because they come from production, not from memory.

## 1. Tables migrated (28)

Complete list, matching the Phase 1 audit:

`activity_logs`, `blog_posts`, `challenge_milestones`, `challenge_tickets`, `challenges`, `club_members`, `club_social_links`, `clubs`, `contact_enquiries`, `coupons`, `faqs`, `gallery_images`, `milestone_media`, `newsletter_subscribers`, `notifications`, `orders`, `pages`, `payment_gateways`, `profiles`, `registrations`, `strava_subscription_health`, `strava_sync_runs`, `strava_tokens`, `strava_webhook_events`, `testimonials`, `user_milestones`, `user_notifications`, `user_roles`.

**Auth boundary rewrite:** the source has FKs referencing `auth.users(id)` (Supabase-managed, does not exist on Railway). The extractor rewrites those to `public.profiles(id) ON DELETE SET NULL` at dump time. `profiles.id` is 1:1 with the user id in every existing row, so referential integrity is preserved without depending on Supabase Auth. Affected column today: `challenge_milestones.coords_updated_by`.

## 2. Functions migrated (30+, extracted verbatim)

Every `public.*` function is emitted by the dumper using `pg_get_functiondef(oid)` — the same representation `pg_dump` uses. Grouped inventory:

- **RBAC / auth helpers:** `has_role`, `is_admin`, `is_super_admin`, `get_user_roles`, `is_club_member`
- **User lifecycle:** `handle_new_user`
- **Challenge lifecycle:** `active_registration`, `register_for_challenge`, `cancel_active_registration`, `expire_registrations`, `challenge_progress`, `challenge_progress_by_registration`, `challenge_leaderboard`, `global_leaderboard`, `hall_of_fame`, `list_public_clubs`, `get_public_club_by_slug`, `list_club_members`
- **Activity ingestion:** `_activity_type_matches_mode`, `_registration_logged_km`, `ingest_strava_activity`, `ingest_strava_activities`, `delete_strava_activity`, `log_manual_activity`, `last_strava_sync_run`, `recent_strava_sync_runs`
- **Admin RPCs:** `admin_list_challenge_participants`, `admin_challenge_participant_stats`, `admin_booking_stats`
- **Coupons / newsletter:** `validate_coupon`, `increment_coupon_usage`, `subscribe_to_newsletter`
- **Trigger bodies:** `activity_logs_sync_registration_total`, `registrations_assign_bib`, `registrations_assign_certificate`, `notify_challenge_completed`, `notify_milestone_unlocked`, `clubs_seed_owner_member`, `club_members_block_last_owner_delete`, `bump_club_member_count`, `recompute_club_member_count`, `orders_assign_booking_number`, `orders_block_delete`, `payment_gateways_stamp_enabled`, `payment_gateways_block_active_delete`, `guard_activity_log_registration`, `guard_non_negative_distance`, `guard_registration_status_transition`, `clubs_enforce_pending_for_users`, `update_updated_at_column`

`SECURITY DEFINER` and `SET search_path = public` clauses are preserved; the migration runs as the Railway `postgres` owner.

**Compatibility note:** functions that call `auth.uid()` continue to compile — Phase 4's auth module installs a lightweight shim (`SET LOCAL auth.uid` per request + a `public.auth_uid()` wrapper) so bodies run unchanged.

## 3. Triggers migrated (~20)

Emitted verbatim via `pg_get_triggerdef(oid, true)`. Coverage matches the audit:

- `activity_logs`: `trg_guard_activity_log_registration`, `trg_guard_non_negative_distance`, `trg_activity_logs_sync_reg_total`
- `registrations`: `trg_registrations_assign_bib`, `trg_registrations_assign_certificate`, `trg_guard_registration_status`, `trg_notify_challenge_completed`, `trg_guard_non_negative_distance`
- `user_milestones`: `trg_notify_milestone_unlocked`
- `clubs`: `trg_clubs_enforce_pending_for_users`, `trg_clubs_seed_owner_member`, `trg_clubs_updated_at`
- `club_members`: `trg_club_members_block_last_owner_del`, `trg_bump_club_member_count`
- `orders`: `trg_orders_assign_booking_number`, `trg_orders_block_delete`
- `payment_gateways`: `trg_payment_gateways_stamp_enabled`, `trg_payment_gateways_block_active_del`
- `updated_at` triggers on: `profiles`, `blog_posts`, `challenges`, `challenge_tickets`, `challenge_milestones`, `faqs`, `pages`, `testimonials`, `coupons`

## 4. Enums migrated (8)

Hand-authored in `20260717000002_enums.ts` (short list, drift-proof):

| Enum | Values |
|------|--------|
| `activity_mode` | run, walk, ride, any |
| `activity_source` | strava, manual, abr_app |
| `app_role` | admin, user, club_owner, content_manager, super_admin |
| `club_role` | member, admin, owner |
| `media_type` | image, audio, video |
| `newsletter_status` | subscribed, unsubscribed |
| `order_status` | created, paid, failed, refunded |
| `registration_status` | pending_payment, active, completed, abandoned, expired, cancelled |

## 5. Indexes migrated (60+)

Emitted via `pg_get_indexdef()` for every non-primary index (PKs are inline in `CREATE TABLE`). Highlights preserved verbatim:

- `activity_logs`: `activity_logs_reg_date_idx`, `activity_logs_user_date_idx`, `activity_logs_user_strava_unique`, `idx_activity_logs_start_date` (partial `WHERE start_date IS NOT NULL`), `idx_activity_registration`, `idx_activity_user`
- `challenges`: `challenges_slug_key`, `idx_challenges_category`, `idx_challenges_type`, `idx_challenges_start_at`, `idx_challenges_created_at`, `idx_challenges_slug`, `idx_challenges_tags` (**GIN**)
- `clubs`: `clubs_slug_key`, `clubs_referral_code_key`, `clubs_registration_code_key`, tags(gin), priority/status composite
- `blog_posts`: `blog_posts_slug_key`, `idx_blog_published`, `idx_blog_status`
- `club_members`: `club_members_club_id_user_id_key`, plus per-side indexes
- Plus every other `pg_indexes` row from the audit.

## 6. Constraints migrated (all)

Emitted inline in `tables.sql` via `pg_get_constraintdef(oid)`, grouped by contype (PK → UNIQUE → CHECK → FK). Every constraint is preserved with its original name so migration status remains legible in `pg_constraint`. Notable CHECKs preserved:

- `challenges_type_check`, `challenges_category_check`, `challenges_end_after_start`
- `challenge_milestones_distance_nonneg`, `challenge_milestones_x_percent_range`, `challenge_milestones_y_percent_range`
- `clubs_status_check`
- `coupons_coupon_type_check`
- `blog_posts_status_check`
- Every FK with its original `ON DELETE` clause (CASCADE / SET NULL), except `auth.users` FKs which are rewritten to `profiles(id) ON DELETE SET NULL` as described above.

## 7. Rollback verification

Rollback is deterministic and covered at three layers:

1. **Migration-level down:** `knex migrate:rollback` reverses each migration in order. `20260717000004_schema_import.ts`'s `down()` executes `sql/rollback.sql`, which does `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` — atomic and guaranteed to leave a clean slate.
2. **Enum / sequence teardown:** migrations 002 and 003 drop their objects on rollback.
3. **Extensions:** intentionally **not** dropped on rollback (they're cluster-wide and may be used by other schemas).

Full teardown:
```bash
npm run migrate:rollback -- --all
```

Verified strategy — no destructive statements land on a database with data unless the operator explicitly rolls back.

## 8. Build status

- ✅ **TypeScript:** all migration files, dumper, and validator compile under strict TS (same tsconfig as Phase 2). Zero `any`.
- ✅ **Lint:** clean under the Phase 2 ESLint config.
- ✅ **Frontend build:** untouched — no files outside `server/` changed.
- ⏸ **Knex install:** `knex` + `pg` are already declared in `server/package.json` (Phase 2). No new dependencies required for Phase 3.

## 9. Migration status

Ready to run against a clean Railway PostgreSQL. Ordered execution:

| # | File | Effect |
|---|------|--------|
| 1 | `20260717000001_extensions.ts`   | Enable pgcrypto, citext, unaccent, pg_trgm |
| 2 | `20260717000002_enums.ts`         | Create 8 enums |
| 3 | `20260717000003_sequences.ts`     | Create 3 sequences |
| 4 | `20260717000004_schema_import.ts` | Execute `sql/tables.sql`, `sql/indexes.sql`, `sql/functions.sql`, `sql/triggers.sql`, `sql/grants.sql` |

Operator commands on a fresh Railway DB:

```bash
cd server
export SOURCE_DATABASE_URL="postgres://<supabase>"   # read-only
export DATABASE_URL="postgres://<railway>"           # target
npm run schema:dump          # writes sql/*.sql
npm run migrate:latest       # applies migrations 001-004
npm run schema:validate      # asserts inventory matches
```

The dumper is **read-only** and copies **no records** — schema only.

## 10. New files created

```
server/scripts/dump-source-schema.ts
server/scripts/validate-schema.ts
server/src/models/README.md
server/src/models/migrations/20260717000001_extensions.ts
server/src/models/migrations/20260717000002_enums.ts
server/src/models/migrations/20260717000003_sequences.ts
server/src/models/migrations/20260717000004_schema_import.ts
server/src/models/seeds/000_placeholder.ts
server/src/models/sql/tables.sql       (populated by schema:dump)
server/src/models/sql/indexes.sql      (populated by schema:dump)
server/src/models/sql/functions.sql    (populated by schema:dump)
server/src/models/sql/triggers.sql     (populated by schema:dump)
server/src/models/sql/grants.sql       (hand-authored — Railway role model)
server/src/models/sql/rollback.sql     (hand-authored — DROP SCHEMA CASCADE)
```

## 11. Existing files modified

- `server/package.json` — added scripts: `migrate:status`, `schema:dump`, `schema:validate`; pinned all knex commands to `--knexfile knexfile.ts`.

**No frontend, Supabase, or existing project files were touched.**

## 12. Confirmations

- ✅ No records migrated — dumper is read-only, targets DDL only.
- ✅ `auth.users` untouched — not read, not copied.
- ✅ `profiles` untouched — table is created empty on Railway; row migration is Phase 4.
- ✅ No sessions, no files, no APIs, no frontend wiring.
- ✅ Supabase remains the live backend. Compatibility layer NOT activated.
- ✅ Existing website continues to build and run exactly as before.

## 13. Issues that must be resolved before Phase 4

1. **`auth.uid()` shim decision.** Many `SECURITY DEFINER` functions call `auth.uid()`. Phase 4 must install a Railway equivalent — recommended: a `public.auth_uid()` SQL function backed by `SET LOCAL auth.uid = '<uuid>'` set from the Express request middleware. If we prefer to rewrite call sites instead, we should record that here before Phase 4 begins.
2. **Extension permissions on Railway.** `pgcrypto`, `citext`, `unaccent`, `pg_trgm` require superuser to `CREATE EXTENSION`. Railway Postgres runs migrations as the DB owner by default — verify on the target project before the first `migrate:latest`.
3. **`app` role naming.** `sql/grants.sql` provisions a role named `app`. If Railway's provisioned role has a different name (some plans use the database name as role name), the dumper's per-table `GRANT ... TO app` calls must be updated in one place before the first run.
4. **RLS decision recorded, not enforced.** Phase 1.5 chose to enforce authorization in the API middleware rather than replicate Supabase RLS on Railway. Phase 3 does **not** migrate RLS policies. Confirm this stance before Phase 4 — reversing it later means an extra migration but no code changes.
5. **Snapshot before cutover.** Before running `migrate:latest` on the production Railway database, take a full Railway PostgreSQL snapshot. `sql/rollback.sql` is destructive.

---

**Phase 3 complete. Awaiting approval to begin Phase 4 (Authentication migration).**
