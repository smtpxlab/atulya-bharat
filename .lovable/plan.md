# Replace Lovable Cloud Auth with Custom Auth

Decisions locked in: **Backend B data first, auth last** · **forced password reset at cutover** · **in-memory access token + HTTP-only refresh cookie** · **Railway (Postgres + Express + Redis)**.

No UI, route, layout, form, or workflow changes anywhere. All work is in `server/`, `src/integrations/`, and the auth bootstrap — plus one *new* admin screen (IAM), which is additive.

---

## Why it's staged

Supabase RLS is the live authorization engine and only trusts GoTrue JWTs. If the token issuer changes while the frontend still calls Supabase directly, every read becomes anonymous and RLS denies it. So Backend B has to be serving data *before* the issuer changes. Stage A makes Express the data path while GoTrue still issues tokens; Stage B swaps the issuer with no data-path change.

---

## Stage A — Backend B becomes the data layer (GoTrue still issues tokens)

**A1. Provision Railway.** Postgres, Redis, and the Express service from `server/Dockerfile`. Health check green at a public URL.

**A2. Migrate schema.** The raw dump is authoritative. Fold it into a Knex `schema_import` migration: all 28 tables, 8 enums, sequences, indexes, the 51 functions and 30 triggers. Strip `auth.*` references, RLS policies, and `auth.uid()` — functions that took it get an explicit `_user_id` argument (the Phase 4 rule). Keep `user_roles`, `has_role`, `is_admin`, `is_super_admin` intact.

**A3. Migrate data.** Export every public table from Cloud and load into Railway preserving **all existing UUIDs** — profiles, orders, registrations, payments, clubs, challenges, notifications, blog authors, activity logs. Row-count and FK-integrity verification per table before proceeding.

**A4. Port the 86 RLS policies into Express.** The one genuinely large piece of work. A policy engine module keyed by the six archetypes already identified (admin full CRUD, owner-only, public read, club-membership, service-only, self-write). Applied per route as middleware, not ad hoc per handler, so coverage is auditable. Backend B is ~60% scaffolded here; the gaps are consistent role enforcement, club-membership checks, and secret-field stripping (`sanitizeResponse` already covers the last one).

**A5. Temporary GoTrue verifier.** Express validates incoming Supabase JWTs against the project JWKS and maps `sub` → user id. Explicitly throwaway, deleted in B4. This is the only moment two systems touch, and only one of them issues tokens.

**A6. Storage + integrations.** Point storage at R2 with the 8 preserved bucket names; migrate existing objects. Razorpay webhook and Strava callback URLs repointed to Railway; BullMQ jobs (Strava sync, registration expiry) running.

**A7. Flip `VITE_BACKEND_ENABLED=true`.** All 54 frontend files keep their `supabase.from(...)` calls unchanged — the compat shim routes them to Express. Full regression pass: every public page, dashboard, checkout, Strava flow, and all 16 admin modules.

**Exit gate:** app fully functional on Railway data, Supabase used *only* for issuing tokens.

---

## Stage B — Custom auth replaces GoTrue

**B1. Identity import.** Populate `app_users` from the existing profiles/users set: same UUIDs, same emails, `password_hash = NULL`, `email_verified_at` carried over. `user_roles` untouched — the five roles and hierarchy stay exactly as-is.

**B2. Complete the auth surface.** Backend B already has register/login/refresh/logout/forgot/reset/verify. Add: change-password, list/revoke active sessions, login history, device tracking. New tables: `login_attempts`, `user_devices`, `audit_logs`.

**B3. Security hardening.** Argon2id (already in place), refresh-token rotation with reuse detection and family revocation, account lockout on the existing `failed_login_count`/`locked_until` columns, per-IP and per-account rate limiting backed by Redis, audit logging on every auth and role event, secret sanitization (done).

**B4. Cookie transport + CSRF.** Refresh token in an HTTP-only, `Secure`, `SameSite=None` cookie scoped to the API origin; access token held in memory only. Double-submit CSRF token on all state-changing requests. CORS configured for the exact frontend origins (preview, published, custom domain). Delete the A5 GoTrue verifier.

**B5. Frontend swap — no visible change.** `src/integrations/backend/auth.ts` becomes the real implementation of the shim's `auth` surface: `signInWithPassword`, `signUp`, `signOut`, `getSession`, `onAuthStateChange`, `resetPasswordForEmail`, `updateUser`. `AuthBootstrap.tsx` calls it instead of Supabase; on boot it does a silent refresh against the cookie and dispatches `sessionLoaded`. `authSlice`, `useAuth()`, `ProtectedRoute`, `Login.tsx`, `Signup.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `AuthPanel.tsx` — **unchanged**. Remember-me maps to a long-lived vs. session refresh cookie.

**B6. Forced password reset.** Login with a null hash returns a "set your password" outcome that reuses the existing forgot-password flow and existing UI. Reset emails route through the current email infrastructure. 10 accounts today, so this is small — but it must be announced before cutover.

**B7. Remove GoTrue.** Delete `@supabase/supabase-js` usage from auth paths, remove `src/integrations/supabase/client.ts`'s GoTrue client, drop the 14 Deno Edge Functions (already ported to Express), retire Supabase env vars. Single auth system, verifiably.

---

## Stage C — IAM module in the admin panel

Additive screen under `/admin`, built with the existing admin component patterns and styling so it looks native:

- **Users** — list, search, activate/deactivate, force reset, unlock.
- **Roles** — assign/revoke the five roles; fixes the current gap where no user holds `super_admin` and there's no UI to grant it.
- **Sessions** — active sessions per user with device/IP/last-seen, revoke one or all.
- **Audit & security logs** — auth events, role changes, lockouts, filterable.

All gated by `requireRole("admin")`, which `super_admin` already satisfies.

---

## Technical notes

- `sanitizeResponse` stays global: `strava_tokens.*`, `payment_gateways.key_secret`, `password_hash` never leave the API.
- Tokens: access ~15 min, refresh 30 days rotating.
- Two origins in play (Lovable-hosted frontend, Railway API), so cookies require `SameSite=None; Secure` and an exact CORS allowlist — this is the most likely source of cutover friction.
- New secrets: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_DOMAIN`, `CORS_ORIGINS`, R2 credentials, SMTP, plus existing Razorpay/Strava keys.
- Tests: extend `security.middleware.test.ts` and `e2e-smoke.test.ts` to cover the policy engine per table, token rotation/reuse, lockout, and CSRF. `supertest` needs installing in the server workspace.

## Risks

- **Policy-port gaps (highest).** A missed RLS rule is a silent data-exposure hole, not a visible error. Mitigation: enumerate all 86 and assert each in tests before A7.
- **Data migration integrity.** Mitigate with per-table row counts and FK checks, and keep Cloud read-only-available until Stage B passes.
- **Cookie/CORS across origins.** Validate in staging on the real published domain, not just localhost.
- **Every user must reset their password.** Unavoidable given the hashes are locked in Cloud; announce it.

## Rough shape

Stage A ~2.5–3 weeks (A4 alone is 8–12 days) · Stage B ~1–1.5 weeks · Stage C ~3–5 days.

I'd build and verify Stage A end-to-end before starting Stage B — the exit gate is a real checkpoint, not a formality.
