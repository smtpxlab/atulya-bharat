# 16 — Recommended Roadmap (30 / 60 / 90 days)

Effort: **S** ≤ 2 days · **M** 2-5 days · **L** 1-2 weeks.

## Next 30 days — "Operational launch readiness"

Goal: clear every P0 in the [debt register](./15-tech-debt-register.md) and migrate the two highest-traffic verticals.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 1 | Wire Sentry + PostHog inside `src/lib/monitoring/index.ts` and edge functions | M | — |
| 2 | Add React Query global `QueryCache.onError` / `MutationCache.onError` → monitoring | S | (1) |
| 3 | Audit `verify-razorpay-payment` (HMAC + DB write path) and fix any gaps | S | — |
| 4 | Build `razorpay-webhook` edge function (signature-verified) + new secret `RAZORPAY_WEBHOOK_SECRET` | M | (3) |
| 5 | Audit & harden `strava-webhook` (verify-token + signature) | S | — |
| 6 | Migration: SECURITY DEFINER `log_activity_and_unlock()` function + revoke EXECUTE on `is_admin`/`has_role`/`get_user_roles` to `authenticated` only + `UNIQUE(user_id, strava_activity_id)` on `activity_logs` + `WITH CHECK` on `activity_logs UPDATE` | M | — |
| 7 | Refactor Dashboard to call the new DB function via a new `activity.service.ts` | M | (6) |
| 8 | Add `<SEO/>` to `/`, `/challenges`, `/challenges/:slug`, `/clubs`, `/clubs/:slug`, `/leaderboard` + `scripts/generate-sitemap.ts` + `predev/prebuild` hooks | M | — |
| 9 | Migrate **Dashboard** vertical (`useMyRegistrations`, `useMyActivities`, `useMyStravaStatus`, `useLogActivity`) to feature hooks | L | (7) |
| 10 | Migrate **Clubs** vertical (`useClubs`, `useClubDetail`, `useJoinClub`, `useCreateClub`) including storage upload service | M | — |
| 11 | Delete dead code: `src/lib/supabaseClient.ts`, `src/App.css` (verified unused) | S | — |

## Next 60 days — "Admin CMS v1 + finish service-layer migration"

Goal: content team unblocked; every page goes through the service layer; analytics + email working.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 12 | Build admin shell (`AdminLayout`, sidebar, role-aware nav) | M | (1) |
| 13 | Admin Challenges editor (challenges + tickets + milestones + media in one nested form) | L | (12) |
| 14 | Admin Blog editor (markdown, cover image, publish toggle) | M | (12) |
| 15 | Admin Contact inbox + Testimonials + Gallery uploads | M | (12) |
| 16 | Admin Users & Roles (super_admin only — grant `club_owner`, `content_manager`) | M | (12) |
| 17 | Migrate **Blog**, **Gallery**, **Leaderboard**, **Contact**, **StravaCallback** verticals to feature hooks | L | (1)(10) |
| 18 | Email provider integration (Resend) + transactional templates (order receipt, registration confirmation, milestone unlock) | M | (4) |
| 19 | Analytics event taxonomy (`src/lib/analytics-events.ts`) + instrument the funnel | S | (1) |
| 20 | Bundle analysis + dynamic-import `html2canvas`, target ≤ 200 KB gzipped initial JS | M | — |
| 21 | Image optimization via Storage transform params | S | — |

## Next 90 days — "Node.js API + mobile-ready architecture"

Goal: stand up dedicated Node API; make web a thin client; mobile-ready.

| # | Task | Effort | Depends on |
|---|---|---|---|
| 22 | Schema design: `notifications`, `device_tokens`, `coupons`, `categories`, `homepage_banners`, `pages`, `faq`, `newsletter_subscribers`, `admin_audit_log` | M | (13) |
| 23 | Stand up Node.js API (Fastify) — auth passthrough, controllers mirroring `src/services/*` shape | L | (17) |
| 24 | Move Razorpay + Strava orchestration into Node API; keep `strava-webhook` as edge proxy that forwards to Node | L | (22)(23) |
| 25 | Swap `src/services/*` internals from `supabase-js` to `fetch(API_URL + ...)` — page code unchanged | M | (23) |
| 26 | Notifications system: device registration, milestone-unlock push, payment-status push | L | (22)(23) |
| 27 | Admin v2: coupons, categories, homepage banners, FAQ, newsletter | L | (22) |
| 28 | Adopt SSR / static pre-render for `/`, `/challenges`, `/blog`, `/challenges/:slug` (improves LCP + social previews ahead of mobile launch) | M | — |
| 29 | E2E test suite (Playwright): signup → register → pay → log activity → unlock milestone | M | (1)(7) |
| 30 | Begin mobile app PoC (React Native or Flutter) consuming the Node API | L | (23)(25)(26) |

## Cross-cutting

- **Weekly tech-debt budget**: 20% of engineering time on P1/P2 items from [§15](./15-tech-debt-register.md) outside the roadmap above.
- **Quarterly security review**: re-run `supabase--linter`, manual RLS read of any new tables, dependency audit (`bun pm ls --outdated`).
- **Definition of done for any new page**: feature hook + service method + Zod schema + monitoring event + `<SEO/>`.
