# 15 — Technical Debt Register

P0 = launch blocker, P1 = ship within 30 days, P2 = next quarter, P3 = nice-to-have.

| Priority | Issue | Impact | Recommendation | Source |
|---|---|---|---|---|
| **P0** | Monitoring is a no-op | Production errors invisible; analytics impossible | Wire Sentry + PostHog inside `src/lib/monitoring/index.ts`; add RQ global error handler | §11 |
| **P0** | No Razorpay webhook | Failed/refunded payments leave `orders` in stale state | Build `razorpay-webhook` edge function with signature verification | §07, §00 R2 |
| **P0** | `verify-razorpay-payment` not audited | Risk of forged payments being marked paid | Open file, confirm HMAC check, document | §07 |
| **P0** | `strava-webhook` verify-token / HMAC unconfirmed | Forged activity events possible | Read file, add checks if missing | §07, §00 R3 |
| **P0** | Client-side milestone unlock non-atomic | Race conditions; user can see inconsistent KM/milestones | Replace with SECURITY DEFINER DB function `log_activity_and_unlock(...)` | §05, §00 R4 |
| **P0** | `EXECUTE` granted to PUBLIC on `is_admin`, `is_super_admin`, `has_role`, `get_user_roles` | Anon can probe admin UUIDs | `REVOKE EXECUTE ... FROM public; GRANT EXECUTE ... TO authenticated;` | §06 L2-L5 |
| **P0** | `activity_logs UPDATE` has no `WITH CHECK` | Owner could reassign `user_id` | Add `WITH CHECK (auth.uid() = user_id)` | §06 S1 |
| **P0** | No `sitemap.xml`, partial SEO | Poor crawl & social previews | Add generator + `<SEO/>` on remaining 10 routes | §09 |
| **P1** | 8 pages bypass service layer | Hard to test, monitor, replace with Node API | Migrate Dashboard, Clubs, Blog, Gallery, Leaderboard, Contact, CreateClub, StravaCallback | §03, §04 |
| **P1** | No Admin CMS | Content team blocked on engineering for every challenge/blog | Build Challenges + Blog admin first | §13 |
| **P1** | No `UNIQUE(user_id, strava_activity_id)` on `activity_logs` | Race between manual sync + webhook can double-insert | Migration to add unique index | §07, §05 |
| **P1** | No image optimization | LCP suffers on cover images | Use Supabase Storage transform params | §10, §08 |
| **P1** | Bundle size unknown | Possible heavy initial JS | Add `rollup-plugin-visualizer`, optimize | §10 |
| **P1** | No analytics event taxonomy | Inconsistent tracking once SDK is wired | Define `src/lib/analytics-events.ts` | §11 |
| **P1** | No notifications system | Cannot tell users about milestones, club invites, payment status | Add table + edge function + provider (FCM / OneSignal) | §13, §14 |
| **P1** | No email provider | Cannot send order receipts or password resets beyond Supabase defaults | Pick Resend / Postmark; add transactional templates | §14 |
| **P2** | Duplicate Supabase client (`src/lib/supabaseClient.ts`) | Confusion | Delete after import-grep | §02 |
| **P2** | `src/App.css` Vite boilerplate | Cruft | Verify unused, delete | §02 |
| **P2** | `<SEO/>` reads `window.location` for canonical | Misses absolute URL | Add `VITE_SITE_URL`, prefix canonical/og:url | §09, §12 |
| **P2** | `useRegisterChallenge` invalidates empty-string key | Stale challenge detail after register | Pass `slug` into args & invalidate `qk.challenges.detail(slug)` | §03 F3 |
| **P2** | Buckets marked `public=false` but readable by anon | Confusing, lint-flag-worthy | Align flag with policy | §08 St1 |
| **P2** | No DB-level audit log for admin mutations | Hard to investigate incidents | New `admin_audit_log` table + trigger or write at service layer | §13 |
| **P2** | No tests beyond one example | Regression risk grows with each migration | Vitest for service layer + RTL for guards/forms; Playwright for register-and-pay flow | — |
| **P2** | `RegistrationModal` / Dashboard use ad-hoc loading flags | UX inconsistency | Adopt React Query + skeletons | §03, §10 |
| **P3** | No `updated_at` columns / triggers | Cache busting needs cohort comparisons | Add columns + BEFORE UPDATE trigger | §05 |
| **P3** | No JSON-LD structured data | Missed rich-results opportunity | Add `Organization`, `Event`, `Article`, `BreadcrumbList` | §09 |
| **P3** | CORS `*` on every edge function | Acceptable but loose | Pin `verify-razorpay-payment` to production origin | §07 |
| **P3** | No `theme-color` / default `og:image` | Polish | Add to `index.html` | §09 |
| **P3** | `club_members INSERT` policy too loose | Spam joining private clubs | Add `EXISTS (clubs.is_public OR invite)` predicate | §06 S2 |
| **P3** | `Contact` form unrate-limited | Spam risk | Add captcha | §06 S4 |
| **P3** | `html2canvas` eager import | Bundle bloat | Dynamic import inside share handler | §10 |
| **P3** | No SSR / pre-render | LCP + social previews suboptimal | Adopt `vite-plugin-ssr` or static pre-render | §10 |
