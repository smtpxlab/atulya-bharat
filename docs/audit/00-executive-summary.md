# 00 — Executive Summary

## Project maturity

**Stage:** Late-MVP / pre-launch.
The product surface is complete (challenges, registration + Razorpay payments, Strava sync, clubs, blog, gallery, leaderboard, contact, dashboard). The Phase-1 architectural foundation (service layer, types, schemas, query keys, monitoring scaffold, lazy routes, ErrorBoundary, RBAC) is in place but only **one** vertical (Challenges) has been migrated to it. The remaining ~8 verticals still call Supabase directly from pages.

The database has **0 production rows** in every business table and only **2 profiles / 3 user_roles** (dev seed accounts). No real users have transacted.

## Production readiness score: **62 / 100**

| Domain | Weight | Score | Notes |
|---|---:|---:|---|
| Security / RBAC / RLS | 25 | 19 | Solid roles + RLS, but `is_admin()` callable by anon, no policies on storage policy verification, `with_check IS NULL` on some updates. |
| Data integrity | 15 | 11 | FKs and unique indexes in place. No DB-side triggers for `updated_at`, no constraint on activity totals, milestone unlock done in JS. |
| Performance | 10 | 8 | Lazy routes, RQ defaults tuned, indexes on hot paths. Bundle not measured. |
| Observability | 10 | 2 | Monitoring is a no-op scaffold. No Sentry, no analytics, no edge-function structured logging. |
| Admin CMS | 15 | 4 | `/admin` placeholder only. No CRUD UI for any domain. |
| Payments | 10 | 6 | Order creation works; **`verify-razorpay-payment` not reviewed in this audit** (`Needs verification`). No webhook for failed/refunded states. |
| SEO | 5 | 2 | `index.html` has defaults; `<SEO/>` used on 6/16 routes; no sitemap.xml; robots is permissive but lists no sitemap. |
| Tests / docs | 10 | 4 | One example vitest. No e2e. Architecture README present. |

## Major strengths

1. **Clean layered architecture is defined** (`src/features/README.md`) — Page → Hook → Service → Supabase — and proven on Challenges.
2. **RBAC done correctly**: separate `user_roles` table, `app_role` enum, `has_role()` / `is_admin()` security-definer functions, route guards (`ProtectedRoute`, `AdminRoute`, `RoleRoute`).
3. **All public tables have RLS enabled** with admin-manage + owner-scoped policies.
4. **Server-trusted pricing** in `create-razorpay-order` (never trusts client amount).
5. **Strava token refresh** implemented in `strava-sync-manual` before each call.
6. **Code-splitting and Suspense** active across every route.

## Major risks

| # | Risk | Severity |
|---|---|---|
| R1 | **Monitoring is a stub** — no error or event will reach an SDK in production. Launching blind. | High |
| R2 | **Payment verification path not audited** (`verify-razorpay-payment` exists but not reviewed against signature validation here) and no Razorpay webhook for async outcomes. | High |
| R3 | **Strava webhook (`strava-webhook`) auth disabled** (`verify_jwt = false`) — required by Strava, but no signature/verify-token check has been confirmed in code. | High |
| R4 | **Dashboard performs milestone unlock + total km update client-side** with non-atomic writes (`Dashboard.tsx:217-260`). Race conditions on concurrent Strava sync are possible. | High |
| R5 | **8/15 routes bypass the service layer** and call `supabase.from(...)` directly from pages. Hard to test, monitor, or replace with a Node API. | Med |
| R6 | **Admin CMS is not built** — content team cannot publish challenges/blogs/etc. without engineering. | Med |
| R7 | **No sitemap.xml**, partial per-page SEO. | Med |
| R8 | **`is_admin()` / leaderboard RPCs `EXECUTE` granted to PUBLIC** (Supabase linter WARN x10). Information disclosure / probing risk. | Med |
| R9 | **No DB triggers for `updated_at`**, no FK from `activity_logs.strava_activity_id` uniqueness per user (only soft-checked in code). | Low |

## Launch blockers (must clear before opening signups)

1. Wire Sentry (or equivalent) into `src/lib/monitoring/index.ts` + edge functions.
2. Add Razorpay webhook (`payment.captured`, `payment.failed`, `refund.processed`) and audit `verify-razorpay-payment` for signature validation.
3. Confirm `strava-webhook` validates `verify_token` on GET and HMAC on POST, or add it.
4. Move milestone-unlock / total-km recompute to a Postgres function or edge function (atomic).
5. Lock down `EXECUTE` on `SECURITY DEFINER` RPCs that don't need anon access (`is_admin`, `is_super_admin`, `has_role`, `get_user_roles`, `bump_club_member_count`, `handle_new_user`).
6. Add at least `sitemap.xml` + canonical/OG on every public route.
7. Set up basic admin UI for Challenges + Blog (content team unblocks).

## Recommended next milestone

> **"Operational launch"** — 30 days. Clear all 7 launch blockers above and migrate Dashboard + Clubs verticals to the service layer. Do **not** start the Node.js backend yet; first finish the service-layer migration so the future Node API can be a drop-in replacement.

See [Roadmap](./16-roadmap.md).
