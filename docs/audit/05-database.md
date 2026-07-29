# 05 — Database Audit

Backend: Lovable Cloud (managed Supabase / Postgres 15).
17 user tables in `public`, all with RLS enabled.

## Live row counts (snapshot)

| Table | Rows |
|---|---:|
| profiles | 2 |
| user_roles | 3 |
| every other table | **0** |

Conclusion: no production traffic yet. Backup/restore not yet exercised against real data.

## Tables

| Table | Purpose | Notable columns | Indexes |
|---|---|---|---|
| `profiles` | User profile (1:1 with `auth.users`) | `id` (= auth uid), `full_name`, `avatar_url`, `city` | PK |
| `user_roles` | RBAC source of truth | `user_id`, `role app_role`; UNIQUE(`user_id`,`role`) | PK, `idx_user_roles_user_id`, `idx_user_roles_role` |
| `challenges` | Virtual challenges catalogue | `slug` UQ, `total_distance_km`, `activity_modes`, `is_active`, `is_featured`, `is_new`, `sort_order`, images | `idx_challenges_active(is_active, sort_order)`, slug UQ |
| `challenge_tickets` | Tiered pricing per challenge | `challenge_id`, `price_inr`, `includes`, `includes_medal`, `sort_order` | `idx_tickets_challenge` |
| `milestones` | Ordered checkpoints inside a challenge | `challenge_id`, `sequence_no`; UNIQUE(`challenge_id`,`sequence_no`) | `idx_milestones_challenge` |
| `milestone_media` | Images / audio / video for a milestone | `milestone_id`, `type media_type`, `url`, `sort_order` | `idx_media_milestone` |
| `user_milestones` | Per-user milestone unlocks | `user_id`, `milestone_id`, `unlocked_at` | PK |
| `registrations` | User → challenge enrollment | `user_id`, `challenge_id`, `status registration_status`, `activity_mode`, `total_km_logged`, `order_id` | PK |
| `activity_logs` | Run/walk/ride entries | `user_id`, `registration_id`, `source activity_source`, `distance_km`, `activity_date`, `strava_activity_id` | `idx_activity_user(user_id, activity_date DESC)`, `idx_activity_registration` |
| `clubs` | Running clubs | `slug` UQ, `promoter_id`, `is_public`, `member_count` | slug UQ |
| `club_members` | Membership (M:N) | `club_id`, `user_id`, `role club_role`; UNIQUE(`club_id`,`user_id`) | `idx_club_members_club`, `idx_club_members_user` |
| `blog_posts` | CMS posts | `slug` UQ, `is_published`, `published_at`, `tags[]` | `idx_blog_published(is_published, published_at DESC)` |
| `gallery_images` | Public gallery | `challenge_id`, `url`, `sort_order` | `idx_gallery_challenge` |
| `orders` | Razorpay orders | `user_id`, `razorpay_order_id` UQ, `razorpay_payment_id`, `status order_status`, `amount_paise` | `idx_orders_user`, `razorpay_order_id` UQ |
| `strava_tokens` | Per-user OAuth tokens | `user_id` UQ, `access_token`, `refresh_token`, `expires_at`, `strava_athlete_id`, `athlete_first_name`, `athlete_last_name`, `scope`, `last_synced_at` | PK |
| `contact_enquiries` | Contact form submissions | `name`, `email`, `subject`, `message`, `created_at` | PK |
| `testimonials` | Testimonials block | (10 cols, content not enumerated) | PK |

## Enums

| Enum | Values |
|---|---|
| `app_role` | `admin`, `user`, `club_owner`, `content_manager`, `super_admin` |
| `club_role` | `member`, `admin`, `owner` |
| `activity_source` | `strava`, `manual`, `abr_app` |
| `activity_mode` | `run`, `walk`, `ride`, `any` |
| `media_type` | `image`, `audio`, `video` |
| `order_status` | `created`, `paid`, `failed`, `refunded` |
| `registration_status` | `pending_payment`, `active`, `completed`, `abandoned` |

## Foreign keys

`information_schema.constraint_column_usage` returned 0 rows for the public schema — this is a **PostgREST/permissions oddity, not absence of FKs**. The migration files do declare FKs (e.g. `challenge_tickets.challenge_id` → `challenges.id`, `club_members.club_id` → `clubs.id`, etc.). Verified visually from `supabase/migrations/20260416205358_*.sql`. Marked `Needs verification` for a live FK dump via privileged role.

## Triggers

`information_schema.triggers` returned 0 rows under the current API role. The codebase declares:

| Trigger | Table | Action |
|---|---|---|
| `on_auth_user_created` | `auth.users` (AFTER INSERT) | `handle_new_user()` — inserts `profiles` + default `user_roles` |
| `bump_club_member_count` triggers | `club_members` (AFTER INSERT/DELETE) | updates `clubs.member_count` |

Both verified in migration SQL. Live presence: `Needs verification`.

**Missing**: no `updated_at` BEFORE UPDATE triggers — but no `updated_at` columns exist either (intentional or oversight).

## RPC functions (SECURITY DEFINER)

| Function | Returns | Purpose | EXECUTE granted to |
|---|---|---|---|
| `has_role(uuid, app_role)` | bool | RBAC check used in RLS policies | PUBLIC (anon callable — see linter WARN) |
| `is_admin(uuid)` | bool | admin/super_admin shortcut | PUBLIC |
| `is_super_admin(uuid)` | bool | super_admin only | PUBLIC |
| `get_user_roles(uuid)` | `app_role[]` | array of roles | PUBLIC |
| `handle_new_user()` | trigger | profile + default role creation | trigger only |
| `bump_club_member_count()` | trigger | recalculates `clubs.member_count` | trigger only |
| `hall_of_fame(int)` | TABLE | last-milestone unlocks across challenges | PUBLIC (intentional — used on home) |
| `global_leaderboard(int, int)` | TABLE | monthly + all-time km leaderboard | PUBLIC (used on Leaderboard) |
| `challenge_leaderboard(uuid, int, int)` | TABLE | per-challenge leaderboard | PUBLIC (used on Leaderboard) |

The Supabase linter flags 8 functions (`WARN 0028`) for being callable without sign-in. Review per-function (§06).

## Views

None defined.

## Migrations chronology

| # | Date | File | Summary |
|---|---|---|---|
| 1 | 2026-04-16 20:53 | `..._d78f3466_*.sql` | Initial schema — all enums, 16 tables, RLS policies, RPCs, triggers, storage buckets (383 lines). |
| 2 | 2026-04-16 21:29 | `..._abdee90f_*.sql` | `strava_tokens`: add `athlete_first_name/last_name`. |
| 3 | 2026-04-16 21:44 | `..._0bc292fe_*.sql` | `club-logos` bucket + policies + `club_members` table (203 lines). |
| 4 | 2026-04-16 21:45 | `..._a332f057_*.sql` | Tighten club-logos read policy. |
| 5 | 2026-06-15 07:09 | `..._a1761edb_*.sql` | `contact_enquiries` table + RLS. |
| 6 | 2026-06-15 09:46 | `..._ef250c52_*.sql` | Extend `app_role` enum: `club_owner`, `content_manager`, `super_admin`. |
| 7 | 2026-06-15 09:46 | `..._b3bde50c_*.sql` | `user_roles` indexes + `is_admin`, `is_super_admin`, `get_user_roles` helpers. |

## Recommendations (DB)

1. Add `BEFORE UPDATE` triggers + `updated_at timestamptz` to `profiles`, `challenges`, `clubs`, `blog_posts` for cache busting.
2. Add a SECURITY DEFINER function `log_activity_and_unlock(user_id, registration_id, distance_km, activity_date, source, raw_data)` that does the activity insert + total update + milestone unlock atomically. Replace Dashboard JS path.
3. Add `UNIQUE(user_id, strava_activity_id)` on `activity_logs` to enforce Strava idempotency at the DB layer.
4. Revoke `EXECUTE ... TO PUBLIC` on `is_admin`, `is_super_admin`, `has_role`, `get_user_roles`; grant to `authenticated` only.
5. Confirm FKs and triggers via privileged dump and document any gaps.
