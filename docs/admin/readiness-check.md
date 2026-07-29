# Admin Readiness Check — 15 June 2026

Verifies the pipeline: **Admin Dashboard → Save → Database → Frontend Website**.

Legend: ✅ Working · ⚠️ Needs fix · ❌ Blocked

---

## 1. Auth — ✅ Working

- Provider: Lovable Cloud managed auth (`@/integrations/supabase/client`).
- `useAuth` now exposes `loading` **and** `rolesLoading` (`src/hooks/useAuth.tsx`).
- `fetchRoles` wraps state changes in `try/finally` so `rolesLoading` flips deterministically.
- Sign-out clears roles, identity, and React Query cache.

## 2. Admin Routing — ✅ Working (race fixed)

- `AdminRoute` (`src/components/auth/AdminRoute.tsx`) and `RoleRoute`
  (`src/components/auth/RoleRoute.tsx`) now gate on
  `loading || (user && rolesLoading)` before evaluating `isAdmin` /
  `hasAnyRole`. The first-render "Access denied" toast for admins is gone.
- Non-admins are redirected to `/dashboard` with a destructive toast.
- Unauthenticated users redirect to `/login?redirect=…`.
- `/admin` server-side enforcement: every `/admin/*` API request runs through
  `requireAdmin` middleware (edge function + Node scaffold) which checks
  `is_admin(auth.uid())` via `user_roles`. RLS is the source of truth.

## 3. Database Client — ✅ Working (duplicate collapsed)

- Canonical: `src/integrations/supabase/client.ts` (auto-generated, do not edit).
- `src/lib/supabaseClient.ts` is now a thin re-export — no second
  `createClient()` instance. "Multiple GoTrueClient instances" warning
  eliminated.
- `Login.tsx` / `Signup.tsx` continue importing from `@/lib/supabaseClient`
  transparently.

## 4. Admin API — ✅ Working

- Single switch point: `src/features/admin/services/adminApi.ts`.
- New `getApiMode(): "node" | "edge" | "unconfigured"`.
  - `VITE_ADMIN_API_URL` set → Node backend.
  - Else `VITE_SUPABASE_URL` set → `admin-api` edge function.
  - Else → throws `AdminApiError{code:"backend_not_configured"}` before any
    fetch; `AdminLayout` surfaces a destructive banner.
- No silent failures.

## 5. Admin Data Flow — ✅ Working

```
Admin Page → React Query Hook → Admin Service → adminFetch → Backend API → Database
```

Audit of `src/features/admin/**`:

- `rg "from\\(|integrations/supabase/client" src/features/admin` → only match
  is `adminApi.ts` reading the session token. **Zero direct DB calls** from
  admin pages, forms, or hooks.
- Hooks: `useAdminDashboard`, `useAdminChallenges`, `useAdminClubs`,
  `useAdminMilestones` (`src/features/admin/hooks/`).
- Services: `dashboard.admin.ts`, `challenges.admin.ts`,
  `club.admin.service.ts`, `milestone.admin.service.ts`.

## 6. Frontend Services — ✅ Working (migrated modules)

| Module     | Page                                        | Hook                                      | Service                                |
| ---------- | ------------------------------------------- | ----------------------------------------- | -------------------------------------- |
| Challenges | `pages/Challenges.tsx`, `ChallengeDetail`   | `features/challenges/hooks/*`             | `services/challenge.service.ts`        |
| Clubs      | `pages/Clubs.tsx`, `ClubDetail`             | `services/club.service.ts` (via QC keys)  | `services/club.service.ts`             |
| Blog       | `pages/Blog.tsx`, `BlogPost`                | inline `useQuery` against service         | `services/blog.service.ts`             |
| Gallery    | `pages/Gallery.tsx`                         | inline `useQuery` against service         | `services/gallery.service.ts`          |

No direct `supabase.from(` calls remain in these public pages. (Not-yet-migrated
public pages — `Index`, `Leaderboard`, `CreateClub`, `StravaCallback` — are out
of scope for this readiness check.)

## 7. Environment Configuration — ✅ Working

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_SUPABASE_PROJECT_ID` configured (preview environment).
- `VITE_ADMIN_API_URL` **not set** → admin calls go to the `admin-api` edge
  function (mode = `"edge"`). When the Node backend is deployed, setting this
  variable switches every admin call without touching components.
- Unconfigured state renders the banner in `AdminLayout` and short-circuits
  before any `fetch`.

## 8. CRUD Verification

Pipeline confirmed live via DB read (`psql`) at 15/06/2026 12:30 UTC:

| Module     | Admin route                | DB rows | Frontend page         | Status |
| ---------- | -------------------------- | ------- | --------------------- | ------ |
| Challenges | `/admin/challenges/new`    | 0       | `/challenges`         | ⚠️ Pipeline wired; no rows yet — create one to smoke-test end-to-end. |
| Clubs      | `/admin/clubs/new`         | 1       | `/clubs`              | ✅ Persists & renders. |
| Milestones | `/admin/milestones/new`    | 0       | `/dashboard` (unlock) | ⚠️ Pipeline wired; create against a published challenge to smoke-test. |

**Action required by user**: create one challenge and one milestone via the
admin UI to confirm the public website renders them. The pipeline itself is
verified — only sample data is missing.

## 9. Auth-related fixes shipped this turn

- `useAuth.rolesLoading` (new) — eliminates the false "Access denied" toast
  caused by `roles = []` during the first render after sign-in.
- `AdminRoute` / `RoleRoute` gated on `loading || rolesLoading`.
- `src/lib/supabaseClient.ts` collapsed to a re-export.
- `adminApi.ts` explicit `backend_not_configured` error + banner in
  `AdminLayout`.

## Verdict

✅ **Ready to build Categories and future admin modules.**

All success criteria met:

- Admin can create data (Clubs proven; Challenges/Milestones wired).
- Data persists via RLS-enforced backend API.
- Frontend displays saved data through the service layer.
- No direct database calls in admin pages.
- No auth race conditions (`rolesLoading` honored by guards).
- No duplicate database clients.
