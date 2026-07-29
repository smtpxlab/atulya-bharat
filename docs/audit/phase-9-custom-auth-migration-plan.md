# Phase 9 — Custom Authentication Migration Plan

**Status:** Analysis & architecture only. **No code was changed.** Lovable Cloud (Supabase GoTrue) authentication remains the live, active auth provider; `VITE_BACKEND_ENABLED` is still `false`.

**Scope:** Replace Lovable Cloud Authentication with an authentication/authorization system fully owned by this application (Express Backend B + Postgres), without breaking any existing functionality.

---

## 1. Current Authentication Architecture

### 1.1 Provider

Authentication is Supabase GoTrue, hosted by Lovable Cloud. The browser talks to GoTrue directly through `@supabase/supabase-js`, created once in `src/integrations/supabase/client.ts` (auto-generated; re-exported by `src/lib/supabaseClient.ts`).

- **Token format:** HS256 JWT issued by GoTrue, containing `sub` (user id), `email`, `role: authenticated`, `aud`, `exp`.
- **Storage:** browser `localStorage`, key `sb-<project-ref>-auth-token`. Readable by JavaScript (XSS-exposed by design).
- **Refresh:** handled invisibly by the SDK (`autoRefreshToken`); the app never sees or manages a refresh token.
- **Transport:** the SDK attaches `Authorization: Bearer <access_token>` to every PostgREST, RPC, Storage, and Edge Function call.

### 1.2 Session bootstrap and state

`src/features/auth/AuthBootstrap.tsx` is mounted once near the router and is the single source of session truth:

1. Subscribes to `supabase.auth.onAuthStateChange(...)` **first** (so no event is missed).
2. Calls `supabase.auth.getSession()` to hydrate the initial state.
3. Dispatches `sessionLoaded({ session })` into the Redux slice `src/store/slices/authSlice.ts`.
4. On a new user id, fetches roles: `supabase.from("user_roles").select("role").eq("user_id", uid)` → `rolesLoaded([...])`.
5. On `SIGNED_OUT`, dispatches `signedOut()` and removes only auth-scoped React Query caches (`user`, `profile`, `dashboard`, `registrations`, `addresses`, `admin-profile`, or `meta.requiresAuth`), preserving public caches.
6. Emits monitoring events (`auth_bootstrap_started`, `auth_bootstrap_completed`, `logout_completed`) and calls `monitoring.identify(...)`.

`src/hooks/useAuth.tsx` is a thin memoized selector over that slice, exposing `user`, `session`, `loading`, `rolesLoading`, `initialized`, `roles`, `isAdmin`, `isSuperAdmin`, `hasRole`, `hasAnyRole`, and `signOut()`.

**Architectural consequence:** all UI consumes auth through `useAuth()`, not through the SDK. Only a small ring of files touches `supabase.auth.*` directly. This is the single most important fact for migration feasibility — see §3.

### 1.3 Flow-by-flow

| Flow | Where | How it works today |
|---|---|---|
| **Login** | `src/pages/Login.tsx`, `src/components/checkout/AuthPanel.tsx` | `supabase.auth.signInWithPassword({email,password})`. Login page does **not** navigate on the promise; a `useEffect` waits for `initialized && user && !rolesLoading`, then redirects via `landingPathForRoles()` (`src/lib/auth/postLoginRedirect.ts`): admins → `/admin`, otherwise a sanitized `?redirect=` path, else `/dashboard`. |
| **Registration** | `src/pages/Signup.tsx` | `supabase.auth.signUp` with `emailRedirectTo`. DB trigger `handle_new_user()` inserts the `profiles` row. Repeated signup with an existing email returns 200 with no email (GoTrue anti-enumeration). |
| **Logout** | `useAuth().signOut()` → `supabase.auth.signOut()` | Cache cleanup is event-driven in `AuthBootstrap`, not in the caller. |
| **Session mgmt** | Supabase SDK | Single session per browser. No server-side session list, no device management, no per-session revoke. |
| **Token mgmt / refresh** | Supabase SDK | Opaque to the app. No rotation policy, no reuse detection visible to us. |
| **Password reset** | `src/pages/ForgotPassword.tsx` → `resetPasswordForEmail(email, { redirectTo: /reset-password })`; `src/pages/ResetPassword.tsx` verifies the recovery event/hash, then `supabase.auth.updateUser({ password })`, then `signOut()`. | Email delivery via Lovable/Supabase shared sender. |
| **Change password** | `src/services/profile.service.ts` (re-authenticates with `signInWithPassword`, then `updateUser`), `src/services/adminProfile.service.ts` | Current-password check is a client-side re-login — weak, see §5. |
| **Email verification** | GoTrue templates | App has no verification UI beyond signup messaging. |
| **Route protection** | `src/components/auth/ProtectedRoute.tsx`, `src/components/auth/AdminRoute.tsx`, wired in `src/App.tsx` | Client-side gates reading `useAuth()`. Real enforcement is server-side RLS. |
| **Admin auth** | Same `/login`, same GoTrue identity | Admin-ness = a row in `public.user_roles`, read into Redux and checked by `AdminRoute` + RLS `is_admin()`. |
| **Authorization** | Postgres | 86 RLS policies plus security-definer functions `has_role(uuid, app_role)`, `is_admin(uuid)`, `is_super_admin(uuid)`, all keyed on `auth.uid()` from the GoTrue JWT. |

### 1.4 Auth-related database schema (today)

- `auth.users` — **owned by GoTrue, privileged, not exportable.** Holds email, bcrypt hash, confirmation state, provider identities.
- `public.profiles` — `id` FK → `auth.users(id)`; app-level user record (name, mobile, city, avatar, totals).
- `public.user_roles` — `(user_id, role app_role)` unique; the authorization source of truth.
- `public.app_role` enum — `admin`, `user`, `club_owner`, `content_manager`, `super_admin`.
- Trigger `handle_new_user()` on signup → creates `profiles`.
- Every user-scoped table (`registrations`, `orders`, `activity_logs`, `strava_tokens`, `user_milestones`, `user_notifications`, `club_members`, …) carries `user_id` FK → `auth.users(id)`.

---

## 2. Dependency Map — Everything Bound to Lovable Cloud Auth

### 2.1 Frontend — direct `supabase.auth.*` call sites (19 across 13 files)

| File | Line(s) | Call |
|---|---|---|
| `src/pages/Login.tsx` | 53 | `signInWithPassword` |
| `src/pages/Signup.tsx` | 48 | `signUp` |
| `src/pages/ForgotPassword.tsx` | 34 | `resetPasswordForEmail` |
| `src/pages/ResetPassword.tsx` | 26, 32, 58, 64 | `onAuthStateChange`, `getSession`, `updateUser`, `signOut` |
| `src/components/checkout/AuthPanel.tsx` | 27 | `signInWithPassword` |
| `src/features/auth/AuthBootstrap.tsx` | 70, 92 | `onAuthStateChange`, `getSession` |
| `src/hooks/useAuth.tsx` | 34 | `signOut` |
| `src/services/profile.service.ts` | 45, 52 | `signInWithPassword` (re-auth), `updateUser` |
| `src/services/adminProfile.service.ts` | 57 | `updateUser` |
| `src/services/challenge.service.ts` | 190 | `getUser` |
| `src/features/admin/services/blog.admin.service.ts` | 65 | `getUser` |
| `src/features/admin/services/page.admin.service.ts` | 69 | `getUser` |
| `src/features/admin/pages/challenges/RouteMapEditor.tsx` | 168 | `getUser` |

### 2.2 Frontend — indirect dependency

Roughly **54 files** call `supabase.from()`, `.rpc()`, `.storage`, or `.functions.invoke()`. None of them mention auth, but every one depends on the GoTrue JWT being attached so RLS resolves `auth.uid()`. These files do **not** need editing if the compatibility shim is used (§4.6), but they all break instantly if the JWT stops being valid without a shim in place.

### 2.3 Context providers / hooks / state

- `src/features/auth/AuthBootstrap.tsx` (the only provider-equivalent)
- `src/hooks/useAuth.tsx`
- `src/store/slices/authSlice.ts` (types `Session`/`User` imported from `@supabase/supabase-js`)
- `src/components/auth/ProtectedRoute.tsx`, `src/components/auth/AdminRoute.tsx`
- `src/lib/auth/postLoginRedirect.ts` (provider-agnostic — no change needed)

### 2.4 Edge functions (Deno, 14 total)

Functions that read the caller's GoTrue JWT from the `Authorization` header and/or call `auth.getUser()`: `create-razorpay-order`, `strava-connect`, and the other user-scoped functions (`strava-sync-manual`, `strava-disconnect`, `verify-razorpay-payment`, `complete-mock-booking`, `strava-athlete-stats`). Webhook functions (`razorpay-webhook`, `strava-webhook`) are unauthenticated/secret-verified and are auth-independent.

All of these are already re-implemented as Express routes/workers in Backend B (Phase 7) and are decommissioned together with Supabase.

### 2.5 Database

- 86 RLS policies referencing `auth.uid()` / `auth.role()`
- `has_role`, `is_admin`, `is_super_admin`, `get_user_roles`, plus ~30 other security-definer functions that assume the GoTrue identity
- `handle_new_user()` trigger on `auth.users`
- All `user_id` FKs → `auth.users(id)`

### 2.6 Environment & configuration

| Key | Where | Role |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (auto-gen) | GoTrue + PostgREST endpoint |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` (auto-gen) | anon JWT |
| `VITE_SUPABASE_PROJECT_ID` | `.env` (auto-gen) | storage key prefix |
| `supabase/config.toml` | repo | project + function config |
| `VITE_BACKEND_ENABLED` / `VITE_BACKEND_URL` / `VITE_BACKEND_API_PREFIX` | `.env` | Backend B shim flag (currently off) |

### 2.7 Replacement surface already built (Backend B, `/server`)

| Concern | File |
|---|---|
| Auth service (register/login/refresh/logout/reset/verify/me) | `server/src/services/auth/auth.service.ts` (349 lines) |
| Argon2id hashing + bcrypt verify-and-upgrade | `server/src/services/auth/password.service.ts` |
| JWT sign/verify + Redis session store | `server/src/services/auth/token.service.ts` |
| REST routes + per-route rate limits | `server/src/routes/auth.routes.ts` |
| Bearer middleware | `server/src/middleware/auth.ts` (`requireAuth`, `optionalAuth`) |
| Role/permission middleware | `server/src/middleware/requireRole.ts` (5-role enum, `super_admin` ⊃ `admin`) |
| Secret stripping on responses | `server/src/middleware/sanitizeResponse.ts` |
| Identity/session/token tables | `server/src/models/migrations/20260718000001_auth_tables.ts` |
| Repositories | `user.repository.ts`, `session.repository.ts`, `verification.repository.ts` |
| Frontend SDK-shaped shim | `src/integrations/backend/auth.ts` + `http.ts`, `config.ts` |

---

## 3. Migration Feasibility

**Verdict: feasible, and unusually low-risk on the frontend — but gated by one hard, non-negotiable blocker.**

**Why the frontend is low-risk:** all UI reads auth from `useAuth()`/Redux, and only 13 files call the SDK directly. The `src/integrations/backend/` shim already mirrors the `{ data, error }` return shape of `supabase.auth.*`, `from()`, `rpc()`, and `storage`, so the swap can be a flag flip plus a handful of import redirects rather than a 54-file rewrite.

**The hard blocker:** `auth.users` bcrypt hashes live in a privileged Supabase schema that Lovable Cloud does not expose — not via the CSV export, not via the service role, not via a project transfer (which is a rebuild, not a detach). **Existing users' passwords cannot be moved.** Options:

1. **Forced reset at cutover** (recommended): pre-seed `app_users` with `password_hash = NULL`; first login attempt routes the user to "set your password" via an emailed one-time token. Cost: one email per active user, some support load.
2. **Dual-read capture window**: before cutover, run both stacks; on each successful GoTrue login, POST the plaintext (over TLS, in-request only, never logged) to Backend B, which Argon2-hashes and stores it. After N weeks, everyone who logged in is migrated; the tail gets a forced reset. Cost: extra code + a real security-review burden. Only worth it above a few thousand active users.
3. Hybrid: capture window for the last 90 days of active users, forced reset for the rest.

**Breaking changes to expect**

- All existing sessions are invalidated at cutover (everyone is logged out once).
- Google/OAuth-created users have no password at all — they *must* take the reset path or an OAuth provider must be re-implemented server-side.
- RLS stops being the enforcement layer the moment `auth.uid()` is gone; every one of the 86 policies must have an Express-layer equivalent **before** cutover, or tables become effectively open to any authenticated caller.
- `Session`/`User` types from `@supabase/supabase-js` in `authSlice.ts` must be replaced with local types.
- Edge functions disappear; their callers must be pointed at Express (already built).

**Required changes at a glance**

- *Database:* re-point `user_id` FKs from `auth.users` → `app_users`; add `login_attempts`, `login_history`/`user_devices`, `audit_logs`; keep `user_roles` unchanged.
- *API:* complete the auth route surface (change-password, verify-email resume, session list/revoke, admin role management).
- *Frontend:* redirect the 13 direct call sites to the shim, replace Supabase types, add "Remember me", add a verify-email page.
- *Security:* move to httpOnly refresh cookies, add CSRF protection, audit logging, and DB-level lockout counters.

---

## 4. Proposed Custom Authentication Architecture

### 4.1 Shape

```text
React SPA
  └── useAuth() / Redux auth slice          (unchanged public API)
        └── src/integrations/backend/auth.ts  (SDK-shaped shim)
              └── HTTPS  /api/v1/auth/*
                    └── Express (Backend B)
                          ├── access JWT   15m, in memory / Authorization header
                          ├── refresh JWT  30d, httpOnly Secure SameSite=Strict cookie
                          ├── Postgres: app_users, refresh_sessions, …
                          └── Redis: session index, rate-limit buckets
```

### 4.2 Token strategy (recommended change from what's built)

| Token | TTL | Storage | Notes |
|---|---|---|---|
| Access | 15 min (`JWT_ACCESS_TTL`) | in-memory JS only (never localStorage) | claims: `sub`, `email`, `roles[]`, `permissions[]`, `sid` |
| Refresh | 30 d, or 12 h when "Remember me" is off | **httpOnly, Secure, SameSite=Strict, Path=/api/v1/auth** cookie | rotated on every use; sha256 hash stored in `refresh_sessions` |

Backend B currently returns the refresh token in the JSON body (bearer style). Moving it to an httpOnly cookie removes the XSS token-theft class entirely and is the single highest-value security upgrade in this migration. Cookie mode requires CSRF defense: double-submit token on state-changing requests, plus `SameSite=Strict` and a strict `CORS_ORIGINS` allow-list.

### 4.3 Capability matrix — built vs missing

| Capability | State | Evidence / gap |
|---|---|---|
| Custom login | **Built** | `auth.service.login()` — inactive check, lockout check, dummy-hash timing defense |
| Custom logout | **Built** | single-session and `allDevices` revoke |
| JWT auth | **Built** | `token.service.ts`, `middleware/auth.ts` |
| Refresh rotation | **Built** | rotate-on-use, `parent_id` family linkage, **reuse detection revokes the whole family** |
| Server session store | **Built (partial)** | `refresh_sessions` table + Redis index; in-memory `Map` fallback is dev-only and must be forbidden in prod |
| Argon2id hashing | **Built** | `password.service.ts`, tuned via `ARGON2_*` env; bcrypt verify-then-rehash on login |
| Password reset | **Built** | sha256-hashed one-time token, 30 min TTL, always-202 anti-enumeration |
| Email verification | **Built** | 24 h token; resend endpoint rate-limited to 5/hour |
| Change password | **Missing** | no `PATCH /auth/password`; today it's a client-side re-login hack |
| Remember me | **Missing** | refresh TTL is a fixed global constant |
| Account lockout | **Partial** | `failed_login_count` + `locked_until` on `app_users`; no per-IP tracking, no unlock/notify path |
| Login history | **Missing** | needs `login_history` |
| Device/session mgmt | **Partial** | data exists (`user_agent`, `ip`, `issued_at`) but no list/revoke endpoints or UI |
| Audit logging | **Missing** | needs `audit_logs` + emitters on role change, admin writes, password change |
| Rate limiting | **Built (partial)** | 20/15min on login+register, 5/hour on reset/resend; per-IP only, in-memory store — must move to Redis for multi-instance |
| CSRF | **N/A today, required with cookies** | bearer mode is CSRF-immune; cookie mode is not |
| XSS | **Improves** | httpOnly refresh + in-memory access token removes the localStorage token that GoTrue uses today |
| Secure cookies | **Missing** | `COOKIE_SECRET` exists in env; no cookie code yet |

### 4.4 Role integration

The DB enum `app_role` (`user`, `admin`, `club_owner`, `content_manager`, `super_admin`) maps 1:1 to the JWT `roles[]` claim, hydrated from `user_roles` at login and re-hydrated on every refresh (so a role change takes effect within one access-token lifetime, ≤15 min). `server/src/middleware/requireRole.ts` already mirrors the enum exactly and expands `admin` → `{admin, super_admin}`, so `super_admin` satisfies all admin gates; `requirePermission` lets `super_admin` bypass granular checks.

Client-side, `useAuth().roles/isAdmin/isSuperAdmin` continues to work verbatim — the shim only changes where roles come from.

**Critical:** once RLS is gone, `user_roles` must be writable *only* through an admin-gated Express route with an audit-log entry. A client-writable roles table is a direct privilege-escalation path. Note also that the DB currently has 1 `admin` and 0 `super_admin` users — the cutover runbook must promote at least one account first.

### 4.5 Database recommendations

| Table | Status | Why |
|---|---|---|
| `app_users` | exists | Canonical identity replacing `auth.users`. `id` deliberately mirrors `profiles.id` (= old `auth.users.id`), so **every existing FK survives untouched**. `password_hash` nullable to allow the reset-based migration; `password_algo` supports the bcrypt→argon2 window; `is_active`, `failed_login_count`, `locked_until` support disable + lockout. |
| `refresh_sessions` | exists | One row per issued refresh token (hashed). Enables rotation, reuse detection via `parent_id` families, per-device session listing, and revoke-all. |
| `email_verifications` | exists | One-time hashed tokens with expiry + `consumed_at` (single-use enforcement). |
| `password_resets` | exists | Same, plus `requested_ip` for abuse forensics. |
| `login_attempts` | **add** | `(email, ip, success, attempted_at, user_agent)`. Enables per-IP and per-account brute-force throttling that survives restarts and works across multiple app instances — the in-memory rate limiter does not. |
| `login_history` / `user_devices` | **add** | User-visible "where you're signed in" + security-alert emails on new device/geo. `refresh_sessions` alone conflates *token* lifetime with *device* identity. |
| `audit_logs` | **add** | `(actor_id, action, entity, entity_id, before, after, ip, created_at)`. Replaces the accountability RLS gave for free; mandatory for role changes, admin CRUD, payment state changes, and password/email changes. |
| `user_roles` | unchanged | Already correct: separate table, enum-typed, unique `(user_id, role)`. |
| `profiles` | FK change only | Re-point `profiles.id` from `auth.users(id)` to `app_users(id)`, and likewise every `user_id` FK across `registrations`, `orders`, `activity_logs`, `strava_tokens`, `user_milestones`, `user_notifications`, `club_members`, `blog_posts.author_id`, `pages.created_by`, `challenges.created_by`, `clubs.created_by`. |

### 4.6 API surface

Existing: `POST /auth/register|login|refresh|logout|forgot-password|reset-password|verify-email|resend-verification`, `GET /auth/me`.

To add: `PATCH /auth/password` (change with current-password proof, revokes all other sessions), `GET /auth/sessions` + `DELETE /auth/sessions/:id`, `GET /auth/login-history`, `POST /auth/email/change` + confirm, admin `GET/POST/DELETE /admin/users/:id/roles` (audited), and `GET /auth/csrf` if cookie mode is adopted.

---

## 5. Security Assessment

| Area | Today (GoTrue) | After migration | Verdict |
|---|---|---|---|
| Password storage | bcrypt, managed | Argon2id (19456 KiB, t=2, p=1) with bcrypt compat | **Improved** |
| Token storage | localStorage (XSS-readable) | access in memory, refresh httpOnly | **Improved** |
| Session expiry | opaque | 15 m access / 30 d refresh, configurable, "remember me" aware | **Improved** |
| Token rotation | opaque | rotate-on-use + family reuse detection (already implemented) | **Improved** |
| Brute force | GoTrue internal | per-IP limiter today; needs per-account + `login_attempts` | **Needs work** |
| Account lockout | GoTrue internal | 10 failures → 15 min lock (implemented); needs notification + admin unlock | **Parity** |
| Rate limiting | GoTrue internal | express-rate-limit, in-memory → must move to Redis store | **Needs work** |
| CSRF | immune (bearer) | required once refresh moves to a cookie | **New requirement** |
| Auditing | none | `audit_logs` (to build) | **Improved** |
| Authorization | 86 RLS policies (defense in depth at the DB) | Express guards only | **Regression risk — the biggest one.** Every policy needs a route-layer equivalent, and a single missed route is a data leak, not a bug. |
| Role escalation | RLS-protected `user_roles` | admin-only audited endpoint | Parity **if** enforced |
| Secret leakage | RLS on `strava_tokens`, `payment_gateways` | `sanitizeResponse.ts` strips `access_token`, `refresh_token`, `key_secret`, `password_hash` | **Covered** |
| Enumeration | GoTrue always-200 | reset/resend always-202, login uses a dummy Argon2 verify for timing | **Parity** |
| Current-password proof | client-side re-login (`profile.service.ts`) | server-side verify in `PATCH /auth/password` | **Improved** |

---

## 6. Migration Roadmap

**Phase A — Preparation (no user impact)**
Promote at least one account to `super_admin`. Freeze auth-surface feature work. Snapshot `profiles` + `user_roles` + all `user_id` values. Decide the password strategy (§3). Provision Railway Postgres + Redis and set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `SMTP_*`, `PUBLIC_APP_URL`. Verify transactional email deliverability from a verified domain — the whole reset-based migration depends on it.

**Phase B — Backend completion**
Build the missing pieces: `login_attempts`, `login_history`, `audit_logs` migrations; httpOnly cookie + CSRF layer; `PATCH /auth/password`; session list/revoke; admin role endpoints with audit emitters; Redis-backed rate limiting; forbid the in-memory session fallback when `NODE_ENV=production`. Then port all 86 RLS policies into route guards, table by table, with a checklist signed off per table.

**Phase C — Frontend migration (behind the flag)**
Point the 13 direct call sites at `src/integrations/backend`. Replace `@supabase/supabase-js` types in `authSlice.ts` with local `AppUser`/`AppSession` types. Add "Remember me" to `Login.tsx`, a `/verify-email` page, and a Security section (active sessions, login history) to the profile. `AuthBootstrap`, `useAuth`, `ProtectedRoute`, `AdminRoute`, and `landingPathForRoles` keep their current shape.

**Phase D — Data migration**
Copy `profiles`/`user_roles` and all business data to Railway Postgres preserving UUIDs. Seed `app_users` from `profiles` with `password_hash = NULL` and `email_verified_at` carried over where known. Re-point FKs to `app_users`. Reconcile row counts per table.

**Phase E — Testing**
Matrix across all five roles: login, wrong password ×10 → lockout, refresh rotation, refresh reuse → family revoke, logout single vs all devices, forgot/reset, verify email, change password, expired/tampered tokens, CSRF probe, admin route access as `user` (must 403) and as `super_admin` (must 200), plus an RLS-parity sweep asserting user A cannot read user B's registrations/orders/activities/tokens.

**Phase F — Rollout**
Staging with `VITE_BACKEND_ENABLED=true` for a full week including a real payment and a real Strava sync. Then a maintenance window: freeze writes → final delta sync → flip the flag → send the "set your password" campaign → monitor login success rate, 401/403 rates, and reset-completion rate for 48 h. Keep the Supabase project read-only and untouched as the rollback target for at least 30 days.

**Phase G — Decommission**
Only after 30 stable days: delete the 14 edge functions, remove `@supabase/supabase-js`, delete `src/integrations/supabase/*` and `supabase/`, drop the `VITE_SUPABASE_*` env keys, and retire the Lovable Cloud backend.

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Password hashes unrecoverable | **Critical** | Accept forced reset; pre-warn users by email; keep the reset link valid 7 days at cutover instead of 30 min |
| An RLS policy has no Express equivalent → data exposure | **Critical** | Per-table sign-off checklist; automated cross-tenant test suite; deny-by-default router (auth required unless explicitly public) |
| Everyone logged out at cutover | High | Schedule a low-traffic window; in-app banner 72 h prior |
| Google/OAuth users have no password | High | Detect provider on seed; send them a dedicated "create a password" email |
| Role data lost/mismapped in migration | High | Row-count + per-role reconciliation query before flag flip; verify `super_admin` exists |
| Refresh cookie misconfigured across domains | Medium | Same-origin API (`/api` proxied under the app domain) avoids third-party cookie issues entirely |
| Rate limiter is per-instance in memory | Medium | Redis store before scaling past one Railway replica |
| Email deliverability sinks the reset campaign | Medium | Verified sending domain + SPF/DKIM/DMARC; batch sends; monitor bounce rate |
| Razorpay/Strava flows break on new identity | Medium | Both are keyed on `user_id` UUIDs, which are preserved; still, run one live payment + one live sync in staging |

---

## 8. Complexity Estimate

| Phase | Effort | Confidence |
|---|---|---|
| A — Preparation | 1–2 days | High |
| B — Backend completion (incl. 86-policy port) | **8–12 days** | Medium — this is the bulk of the work |
| C — Frontend migration | 3–4 days | High |
| D — Data migration | 2–3 days | Medium |
| E — Testing | 4–5 days | Medium |
| F — Rollout + monitoring | 2 days + 48 h watch | Medium |
| G — Decommission | 1 day | High |
| **Total** | **≈ 4–5 focused weeks** | |

Roughly 60% of the auth code already exists in `/server`. The dominant cost is not writing login — it is faithfully reproducing 86 database-enforced access rules in application code and proving the reproduction is complete.

---

## 9. Deliverable Summary

- **Current architecture:** §1 · **Dependency map:** §2 · **Feasibility:** §3
- **Proposed architecture:** §4 · **Database recommendations:** §4.5 · **API recommendations:** §4.6
- **Security assessment:** §5 · **Roadmap:** §6 · **Risks:** §7 · **Complexity:** §8

**Nothing in this document has been implemented.** Login, logout, sessions, and roles behave exactly as before.
