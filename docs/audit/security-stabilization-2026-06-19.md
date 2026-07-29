# Security Stabilization — 2026-06-19

Follow-up to `security-hardening-2026-06-19.md`. Audits the post-hardening
state of RLS, helper-function grants, and frontend auth guards, and applies
two targeted fixes.

## Audit findings

### Already correct (verified, no change)

- Helper functions `is_admin`, `is_super_admin`, `has_role`, `is_club_member`,
  `get_user_roles` are all `SECURITY DEFINER` and have `EXECUTE` granted to
  `authenticated` only (not `anon`). Verified via `pg_proc.prosecdef` and
  `proacl`.
- Public-read policies cover anonymous content visibility:
  - `challenges` — `status = true`
  - `blog_posts` — `is_published = true`
  - `faqs` — `status = true OR is_admin(...)`
  - `pages` — `status = 'enabled'`
  - `gallery_images`, `testimonials` — fully public SELECT
  - Clubs are read through SECURITY DEFINER RPCs `list_public_clubs` and
    `get_public_club_by_slug`, which expose only safe columns.
- Admin `ALL` policies are scoped `TO authenticated` and OR-combine with the
  public policies — they do not block anon reads.
- Frontend join entry points (`src/pages/Clubs.tsx`, `src/pages/ClubDetail.tsx`)
  already short-circuit to `/login?redirect=...` when `!user`.
- `Login.tsx` waits for `rolesLoading` before redirecting via
  `landingPathForRoles`, so admins land on `/admin` and users on `/dashboard`.

### Gaps fixed in this pass

1. `club_members` policy **"Users join clubs"** was `TO authenticated` with no
   `WITH CHECK` — an authenticated user could insert a membership row for any
   `user_id`. Now `WITH CHECK (auth.uid() = user_id)`.
2. `clubs` policy **"Authenticated create clubs"** had the same shape. Now
   `WITH CHECK (auth.uid() = created_by)`. The existing trigger
   `clubs_enforce_pending_for_users` already coerces `created_by := auth.uid()`
   when null, so the existing create-club flow is unaffected.
3. Frontend did not normalize Postgres `42501` / PostgREST `PGRST301` /
   JWT-expired errors. Added `isAuthRequiredError` in `src/services/errors.ts`
   and wired it into:
   - `useJoinClub` — toast "Please sign in to continue." + redirect to
     `/login?redirect=...`
   - `Dashboard.handleLogActivity` — same UX for stale sessions when logging
     an activity.

## Files touched

- `supabase/migrations/<timestamp>_*.sql` — recreates the two INSERT policies
  with `WITH CHECK`.
- `src/services/errors.ts` — adds `isAuthRequiredError`, tags wrapped errors
  with `code: "auth_required"`.
- `src/features/clubs/hooks/useClubs.ts` — auth-required branch in
  `useJoinClub.onError`.
- `src/pages/Dashboard.tsx` — auth-required branch around
  `activity_logs.insert`.

## Out of scope (intentionally not changed)

- Helper-function grants — already correct.
- Public read policies — already cover the documented anon use cases.
- `<UserRoute>` / `<AdminRoute>` — already implement the documented redirect
  behavior.
- A Playwright regression suite checked into the repo — can be added as a
  follow-up if desired.
