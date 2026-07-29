# Phase 1 — Migration Report: Lovable Cloud → Node.js + Express + Railway Postgres

**Scope:** Read-only audit. Goal is to eliminate the dependency on Lovable Cloud (Supabase) and move to a self-hosted stack: **React (unchanged) → Node.js/Express API → Railway PostgreSQL**, without altering the UI.

Project: Atulya Bharat Run (ABR). Type: single-page React application with a Supabase-managed backend (Auth, PostgREST, Edge Functions, Storage, Realtime).

---

## 1. Project Architecture (Current)

```
Browser (React SPA)
   │
   ├── @supabase/supabase-js  ← ONE client, imported everywhere
   │      ├── auth  (GoTrue, JWT in localStorage)
   │      ├── from(table).select/insert/update/delete   (PostgREST + RLS)
   │      ├── rpc(fn_name, args)                        (Postgres SECURITY DEFINER functions)
   │      ├── functions.invoke(name)                    (Deno Edge Functions)
   │      ├── storage.from(bucket)                      (Supabase Storage)
   │      └── channel().on('postgres_changes')          (Realtime WebSocket)
   │
   └── Third parties called from browser:
          └── Razorpay Checkout SDK (checkout.razorpay.com)

Supabase-hosted:
   PostgreSQL 15 (public schema + auth schema)
   PostgREST (auto REST API from tables/views/RPCs)
   GoTrue (auth)
   Edge Runtime (Deno)
   Storage (S3-compatible)
   Realtime (postgres_changes)

External APIs (unchanged after migration):
   Razorpay (payments)  ·  Strava (OAuth + activities + webhook)
```

## 2. Folder Structure (high level)

```
src/
  App.tsx                          Router + providers
  main.tsx                         Entry
  integrations/supabase/           ⚠ AUTO-GENERATED — must be replaced
    client.ts                        createClient(SUPABASE_URL, ANON_KEY)
    types.ts                         DB types generated from Supabase schema
  lib/supabaseClient.ts            Legacy re-export
  hooks/useAuth.tsx                Reads Redux auth slice (Supabase session)
  store/slices/authSlice.ts        Redux auth state (session, roles)
  features/auth/AuthBootstrap.tsx  onAuthStateChange + roles fetch
  services/*.service.ts            All data access (24 files, all use supabase)
  features/<domain>/hooks/         React Query hooks calling services
  features/admin/                  Full admin app (pages/services/hooks)
  pages/                           Route components
  components/                      UI (shadcn + custom) — NO backend deps
supabase/
  functions/                       14 Deno Edge Functions
  config.toml                      Edge function config
  migrations/                      SQL migrations (schema history)
public/, scripts/, docs/
```

## 3. Frontend Technologies (all remain unchanged)

| Layer | Tech |
|---|---|
| Framework | React 18 + Vite 5 + TypeScript 5 |
| Routing | react-router-dom 6 |
| State | Redux Toolkit (auth/UI) + TanStack Query 5 (server cache) |
| UI | Tailwind CSS 3 + shadcn/ui + Radix + framer-motion |
| Forms | react-hook-form + zod |
| Editor | Tiptap 3 |
| Payments SDK | `checkout.razorpay.com/v1/checkout.js` (client) |
| Misc | date-fns, dompurify, html2canvas, nprogress, lucide-react |

**Only backend SDK to remove:** `@supabase/supabase-js`.

## 4. Current Backend Architecture

- **Database:** Supabase-hosted Postgres 15, `public` schema, ~27 tables, ~15 enums, RLS on every table.
- **API surface:** PostgREST auto-generated from tables + ~35 SECURITY DEFINER RPCs (see §7).
- **Auth:** Supabase GoTrue. JWTs in `localStorage`, refresh via `autoRefreshToken`. `handle_new_user()` trigger on `auth.users` seeds `profiles` + default `user` role.
- **Authorization:** RLS policies + `has_role(uid, role)` / `is_admin(uid)` security-definer helpers reading `public.user_roles`.
- **Realtime:** `postgres_changes` subscription on `registrations` (used in `useRegistrationRealtime`).
- **Edge Functions (Deno):** 14 functions for payments, Strava, contact form.
- **Storage buckets:** `blog-images`, `challenge-assets`, `club-banners`.

## 5. Every Place Supabase Is Used

**Client import path:** `@/integrations/supabase/client` (canonical) and `@/lib/supabaseClient` (re-export).

- **54 source files** in `src/` import `supabase`.
- All 24 files in `src/services/*.service.ts` — every data-access call.
- All 8 files in `src/features/admin/services/*` — admin CRUD.
- `src/features/auth/AuthBootstrap.tsx` — session hydration.
- `src/pages/Login.tsx`, `Signup.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `StravaCallback.tsx` — direct `supabase.auth.*` calls.
- `src/features/registrations/hooks/useRegistrationRealtime.ts` — Realtime channel.
- `src/integrations/supabase/types.ts` — DB type source of truth for the whole app.

## 6. Every API Call

### 6.1 PostgREST table reads/writes (`supabase.from(<table>)`)
Used across all services. Tables touched from the client:
`activity_logs`, `blog_posts`, `challenge_milestones`, `challenge_tickets`, `challenges`, `club_members`, `club_social_links`, `clubs`, `contact_enquiries`, `coupons`, `faqs`, `gallery_images`, `milestone_media`, `newsletter_subscribers`, `notifications`, `orders`, `pages`, `payment_gateways`, `profiles`, `registrations`, `strava_subscription_health`, `strava_sync_runs`, `strava_tokens`, `strava_webhook_events`, `testimonials`, `user_milestones`, `user_notifications`, `user_roles`.

### 6.2 RPC calls (client → SECURITY DEFINER functions)
`active_registration`, `admin_booking_stats`, `cancel_active_registration`, `challenge_leaderboard`, `challenge_progress_by_registration`, `delete_strava_activity`, `expire_registrations`, `global_leaderboard`, `hall_of_fame`, `increment_coupon_usage`, `ingest_strava_activities`, `ingest_strava_activity`, `is_admin`, `last_strava_sync_run`, `list_club_members`, `list_public_clubs`, `log_manual_activity`, `register_for_challenge`, `subscribe_to_newsletter`, `validate_coupon`.

### 6.3 Edge Functions invoked from client (`supabase.functions.invoke`)
`create-razorpay-order`, `verify-razorpay-payment`, `strava-config`, `strava-connect`, `strava-disconnect`, `strava-sync-manual`, `strava-athlete-stats`.

### 6.4 Storage
Uploads/downloads via `supabase.storage.from('<bucket>')` for the three buckets in §11.

### 6.5 Realtime
`supabase.channel('registration:<id>').on('postgres_changes', …)` — a single subscription for live progress on the registration detail page.

## 7. Every Database Table (27)

| Table | Purpose |
|---|---|
| `profiles` | User profile (1-1 with auth.users) |
| `user_roles` | RBAC (`app_role` enum: user, admin, super_admin) |
| `user_notifications` | Per-user notification inbox |
| `notifications` | Admin-authored broadcast/system notifications |
| `challenges` | Virtual challenges (25 cols; slug, distance, dates, media) |
| `challenge_tickets` | Ticket tiers per challenge (price_inr, quotas) |
| `challenge_milestones` | KM milestones per challenge (spot, distance, media) |
| `milestone_media` | Additional media per milestone |
| `registrations` | User↔challenge with status, bib, certificate, total_km |
| `activity_logs` | Individual activities (manual + Strava) |
| `user_milestones` | Unlocked milestones per registration |
| `orders` | Immutable payment ledger (Razorpay) |
| `coupons` | Discount codes |
| `payment_gateways` | Config for enabled payment providers |
| `clubs` | Club directory (34 cols) |
| `club_members` | Membership + role (owner/admin/member) |
| `club_social_links` | Per-club social links |
| `blog_posts` | CMS blog |
| `pages` | CMS legal/static pages |
| `faqs` | FAQ CMS |
| `gallery_images` | Gallery CMS |
| `testimonials` | Testimonial CMS |
| `contact_enquiries` | Contact form submissions |
| `newsletter_subscribers` | Newsletter list |
| `strava_tokens` | Per-user Strava OAuth tokens |
| `strava_sync_runs` | Sync run audit log |
| `strava_subscription_health` | Webhook health tracker |
| `strava_webhook_events` | Raw webhook payloads |

Plus Supabase-managed `auth.users` (must be migrated separately).

## 8. Every Database Function / RPC (~35)

Grouped by responsibility. All are `SECURITY DEFINER` with `search_path = public`.

**RBAC / auth**
- `has_role(uid, role)`, `is_admin(uid)`, `is_super_admin(uid)`, `get_user_roles(uid)`
- `handle_new_user()` — trigger on `auth.users` insert (creates profile + default role)

**Registrations & progress**
- `register_for_challenge`, `cancel_active_registration`, `active_registration`
- `expire_registrations`, `challenge_progress`, `challenge_progress_by_registration`
- `_registration_logged_km` (helper), `_activity_type_matches_mode` (helper)
- `admin_force_complete_registration`

**Activity logging**
- `log_manual_activity`, `ingest_strava_activity`, `delete_strava_activity`

**Leaderboards**
- `challenge_leaderboard`, `global_leaderboard`, `hall_of_fame`

**Coupons**
- `validate_coupon`, `increment_coupon_usage`

**Admin**
- `admin_list_challenge_participants`, `admin_challenge_participant_stats`, `admin_booking_stats`

**Clubs**
- `list_public_clubs`, `get_public_club_by_slug`, `list_club_members`, `is_club_member`
- `recompute_club_member_count`

**Newsletter**
- `subscribe_to_newsletter`

**Strava audit**
- `last_strava_sync_run`, `recent_strava_sync_runs`

## 9. Every Trigger

- `on_auth_user_created` → `handle_new_user()` (creates profile + role)
- `update_<table>_updated_at` → `update_updated_at_column()` (all tables with updated_at)
- `orders_assign_booking_number` (BEFORE INSERT)
- `orders_block_delete` (BEFORE DELETE — orders are immutable)
- `registrations_assign_bib` (BEFORE INSERT)
- `registrations_assign_certificate` (BEFORE UPDATE — on status→completed)
- `guard_registration_status_transition` (state-machine enforcement)
- `guard_activity_log_registration` (ownership + active check)
- `guard_non_negative_distance` (activity_logs, registrations)
- `activity_logs_sync_registration_total` (denormalizes total + auto-completes)
- `notify_milestone_unlocked` (AFTER INSERT on user_milestones → inserts user_notifications row)
- `clubs_seed_owner_member` (AFTER INSERT on clubs)
- `clubs_enforce_pending_for_users` (BEFORE INSERT — forces status=pending)
- `bump_club_member_count` (INSERT/DELETE on club_members)
- `club_members_block_last_owner_delete`
- `payment_gateways_stamp_enabled`, `payment_gateways_block_active_delete`

## 10. Every RPC — see §6.2 and §8.

## 11. Every Storage Bucket

| Bucket | Contents | Used by |
|---|---|---|
| `blog-images` | Blog post cover + inline images | Admin blog editor, rich-text uploads |
| `challenge-assets` | Challenge cover, milestone media, participation photos | Admin challenges/milestones, dashboard uploads |
| `club-banners` | Club logo + banner | Admin clubs, CreateClub page |

Access pattern: signed URLs / public URLs via `supabase.storage.from(...).getPublicUrl()` and `upload()`.

## 12. Every Edge Function (14)

| Function | verify_jwt | Purpose | Secrets used |
|---|---|---|---|
| `create-razorpay-order` | ✓ | Trusted price lookup + create Razorpay order | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET |
| `verify-razorpay-payment` | ✓ | HMAC-verify Razorpay signature, mark order paid, create registration | RAZORPAY_KEY_SECRET |
| `complete-mock-booking` | ✓ | Free/100%-coupon booking path | — |
| `razorpay-webhook` | ✗ | Async payment events | RAZORPAY_WEBHOOK_SECRET |
| `contact-form` | ✗ | Public contact form intake | (SMTP if any) |
| `strava-config` | ✗ | Expose STRAVA_CLIENT_ID to browser | STRAVA_CLIENT_ID |
| `strava-connect` | ✓ | OAuth code → tokens, upsert strava_tokens | STRAVA_CLIENT_ID/SECRET, SERVICE_ROLE |
| `strava-disconnect` | ✓ | Revoke + delete token row | SERVICE_ROLE |
| `strava-sync-manual` | ✓ | Refresh token + fetch new activities | STRAVA_*, SERVICE_ROLE |
| `strava-cron-sync` | ✗ | Scheduled sync for all users | STRAVA_*, SERVICE_ROLE |
| `strava-webhook` | ✗ | Receive Strava activity events | STRAVA_VERIFY_TOKEN, SERVICE_ROLE |
| `strava-webhook-setup` | ✓ | Admin: register subscription | STRAVA_* |
| `strava-subscription-health` | ✓ | Admin health check | STRAVA_* |
| `strava-athlete-stats` | ✓ | Fetch athlete summary from Strava | STRAVA_* |

## 13. Every Environment Variable

**Client (Vite — public):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

**Edge Functions (server-side secrets):**
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` (auto-injected by Supabase runtime)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`

**After migration** the Supabase-prefixed vars are replaced by:
- `DATABASE_URL` (Railway Postgres)
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` (or Cloudflare R2 / Railway volume)
- `SMTP_HOST/PORT/USER/PASS/FROM` (for password reset + notifications)
- `VITE_API_BASE_URL` (client points here instead of Supabase URL)

## 14. Every Third-Party Integration

| Integration | Where | Migration impact |
|---|---|---|
| **Supabase** (Auth + DB + Storage + Realtime + Functions) | Everywhere | **Removed entirely** |
| **Razorpay** | `create-razorpay-order`, `verify-razorpay-payment`, `razorpay-webhook`, client checkout SDK | Stays. Reimplement 3 endpoints in Express. |
| **Strava** | 8 edge functions + `StravaCallback.tsx` | Stays. Port 8 edge functions to Express routes + a cron worker. |
| **Email/SMTP** | Auth emails (Supabase-managed) + contact form | Replace with Nodemailer + SMTP provider (Resend/SES/Sendgrid). |
| **Google Fonts / lucide-react / date-fns / dompurify** | Client only | No change. |

**No hidden third parties** beyond Razorpay + Strava + SMTP.

## 15. Dependencies That Must Be Replaced

**Remove from `package.json`:**
- `@supabase/supabase-js`

**Add (client):**
- `axios` or continue with `fetch` (thin API client)

**Add (new Node/Express backend project):**
- `express`, `cors`, `helmet`, `compression`, `cookie-parser`
- `pg` + `drizzle-orm` (or `prisma`, or `knex`) — pick one ORM
- `jsonwebtoken`, `bcrypt`, `argon2` (password hashing)
- `zod` (share schemas with client)
- `multer` + `@aws-sdk/client-s3` (uploads to S3/R2) OR `sharp` for image processing
- `nodemailer`
- `razorpay` (official SDK)
- `node-cron` or BullMQ (Strava periodic sync)
- `ws` or `socket.io` (Realtime replacement for registration progress)
- `pino` (logging)

## 16. Every Page That Depends on Supabase

**Public / user pages** (all of them — every page pulls data through a service that uses `supabase`):

Home (`Index`), `Challenges`, `ChallengeDetail`, `CheckoutPage`, `Clubs`, `ClubDetail`, `CreateClub`, `Leaderboard`, `Blog`, `BlogPost`, `Gallery`, `Contact`, `About`, `LegalPage`, `Dashboard`, `Profile`, `Notifications`, `RegistrationDetail`, `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `StravaCallback`.

**Admin pages** (under `/admin/*`):
Dashboard, Challenges (list/new/edit/edit-route/participants), Milestones (list/create/edit), Clubs (list/new/edit/reports/detail), Coupons (list/new/edit), Bookings (list/detail), Blog (CRUD), Pages (CRUD), FAQs, Gallery, Newsletter, Notifications (list/new), Testimonials, Categories, Banners, Payments (payment gateway config), Profile.

**Auth-agnostic components** (no backend deps): all of `src/components/` (UI primitives, layout, shared) — safe.

## 17. Admin Features (all Supabase-backed)

- Role-gated by `AdminRoute` → checks Redux `isAdmin` → validated server-side by `is_admin()` in every admin RPC and RLS policy.
- CRUD for: challenges, tickets, milestones, milestone media, coupons, clubs, blog posts, CMS pages, FAQs, gallery, testimonials, banners, newsletter, notifications, payment gateways.
- Reports: booking stats (`admin_booking_stats`), participant lists (`admin_list_challenge_participants`), club reports.
- Admin actions: force-complete registration, publish/unpublish, feature toggles.

## 18. User Features (all Supabase-backed)

- Signup/login/password reset (GoTrue)
- Profile + avatar upload
- Browse challenges/clubs/blog/gallery
- Register for a challenge (paid via Razorpay or free via coupon)
- Log manual activity / connect Strava / auto-sync activities
- Real-time progress on registration page (Realtime)
- Milestones unlock → notification inbox
- Bib + certificate auto-generation on completion
- Leaderboards (challenge + global + hall of fame)
- Create / join clubs
- Newsletter subscribe, contact form

## 19. Payment Features

- **Provider:** Razorpay only.
- **Flow:** client → `create-razorpay-order` (edge) → Razorpay Checkout → `verify-razorpay-payment` (edge, HMAC check) → creates `orders` + activates `registrations`.
- **Free path:** `complete-mock-booking` for 100% coupon or zero-priced tickets.
- **Coupons:** `validate_coupon` (RPC) at checkout, `increment_coupon_usage` on success.
- **Webhook:** `razorpay-webhook` for async `payment.failed` / `payment.captured` / `refund.processed`.
- **Ledger:** `orders` table is immutable (DELETE trigger blocks it).

## 20. Notification Features

- **In-app inbox:** `user_notifications` table + trigger `notify_milestone_unlocked`. Read via `useUserNotifications` and displayed in `NotificationBell` + `Notifications` page.
- **Admin broadcast:** `notifications` table populated by admin, read publicly (`usePublicNotifications`).
- **Realtime updates:** currently only for `registrations` progress (single channel).

## 21. Email Features

- **Auth emails** (signup confirmation, password reset, magic link): fully handled by Supabase GoTrue — templates configurable in Supabase.
- **Transactional:** none currently outside auth. Contact form (`contact-form` edge function) stores to DB; no outbound email today unless the function forwards to SMTP (verify in file).

---

## 22. Migration Roadmap — Lovable Cloud → Node/Express + Railway Postgres

### Target architecture

```
React SPA (unchanged UI)
   │  fetch/axios → JSON REST + WebSocket
   ▼
Express API (Node.js 20 on Railway)
   ├── /auth        JWT (access + refresh), bcrypt/argon2
   ├── /api/*       Domain routes replacing PostgREST + RPCs
   ├── /webhooks    Razorpay, Strava
   ├── /uploads     Multer → S3/R2 (or Railway volume)
   ├── /realtime    Socket.IO room per registration
   └── /cron        node-cron (or Railway cron) for Strava sync + expiries
        │
        ▼
Railway PostgreSQL 15  (plain Postgres — RLS optional, enforced in app layer)
Railway object storage / Cloudflare R2  (bucket per current Supabase bucket)
SMTP (Resend/SES) for auth + notification emails
```

### Phase-by-phase plan

**Phase 2 — Data layer + schema migration**
1. Export `public` schema DDL (tables, enums, functions, triggers, indexes, sequences) as raw SQL.
2. Create a new Railway Postgres. Apply DDL as-is — all RPCs/triggers keep working at DB level and can be called from Node the same way.
3. Migrate data with `pg_dump`/`COPY`.
4. Migrate `auth.users` → new `users` table (id, email, password_hash, email_verified_at, created_at). Because Supabase stores bcrypt-compatible hashes in `auth.users.encrypted_password`, hashes port over — users keep their passwords.
5. Backfill `profiles.email` from users if not already present.

**Phase 3 — Node/Express API skeleton**
1. New repo (or `/server`) with Express + TS + Drizzle/Prisma pointed at Railway DB.
2. Middleware: `helmet`, `cors` (allow the SPA origin), `cookie-parser`, `express-rate-limit`, request logging (pino), zod validation, error handler.
3. Auth module: `POST /auth/signup`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/me`. Access token (15 min) in Authorization header, refresh token in httpOnly cookie.
4. Role middleware reading `user_roles` — replaces RLS `is_admin` checks.

**Phase 4 — API endpoints (feature-for-feature)**
Group by service file (each `src/services/*.service.ts` maps 1:1 to a route group). All existing RPCs stay as Postgres functions and are called via `pool.query('SELECT * FROM fn(...)')` — no logic rewrite needed initially.

| Client service | New Express routes |
|---|---|
| `profile.service` | `GET/PUT /me/profile`, `POST /me/avatar` |
| `challenge.service` | `GET /challenges`, `GET /challenges/:slug` |
| `registration.service` | `POST /registrations` (calls `register_for_challenge`), `DELETE /registrations/active` |
| `challenge-progress.service` | `GET /registrations/:id/progress` |
| `challengeMilestone.service` | `GET /challenges/:id/milestones` |
| `club.service` | `GET /clubs`, `GET /clubs/:slug`, `POST /clubs`, `GET /clubs/:id/members` |
| `blog.service` | `GET /blog`, `GET /blog/:slug` |
| `page.service` | `GET /pages/:slug` |
| `faq.service` | `GET /faqs` |
| `gallery.service` | `GET /gallery` |
| `testimonial.service` | `GET /testimonials` |
| `coupon.service` | `POST /coupons/validate` |
| `newsletter.service` | `POST /newsletter/subscribe` |
| `notification.service` + `userNotifications.service` | `GET /notifications`, `GET /me/notifications`, `PATCH /me/notifications/:id/read` |
| `contact.service` | `POST /contact` |
| `strava.service` | `GET /strava/config`, `POST /strava/connect`, `POST /strava/disconnect`, `POST /strava/sync`, `GET /strava/stats` |
| `payment.service` | `POST /payments/orders`, `POST /payments/verify`, `POST /payments/mock-booking` |
| Admin services (8 files) | `/admin/*` — challenges, clubs, blog, pages, gallery, bookings, participants, payment gateways |

**Phase 5 — Edge Functions → Express handlers**
Each Deno function becomes one Express handler with equivalent logic. Razorpay/Strava webhook endpoints are public (`/webhooks/razorpay`, `/webhooks/strava`) with signature verification.

**Phase 6 — Storage**
Replace `supabase.storage`:
- Option A: **Cloudflare R2** (S3-compatible, cheap, keep bucket names).
- Option B: Railway persistent volume with an Express `/uploads` static route.
Rewrite each service that uploads to call `POST /uploads/:bucket` returning `{ url }`. Store the returned URL in the same DB columns.

**Phase 7 — Realtime**
Replace `supabase.channel('registration:<id>')` with a Socket.IO room. Emit from the Node process inside the `log_manual_activity` / `ingest_strava_activity` post-commit path (or via LISTEN/NOTIFY on Postgres — cleanest since RPCs already live in DB).

**Phase 8 — Frontend swap (no UI changes)**
1. Create `src/api/http.ts`: `fetch` wrapper with base URL from `VITE_API_BASE_URL` and JWT header injection.
2. Rewrite `src/integrations/supabase/client.ts` as a thin façade exposing the same method surface (`.from`, `.rpc`, `.functions.invoke`, `.storage`, `.auth`) but routing to the new REST API. This keeps all 24 services + 54 files working with **zero UI changes**. Delete the façade later when convenient.
3. Replace `AuthBootstrap` internals: on mount, call `/auth/me` with stored refresh token → dispatch `sessionLoaded`. Keep Redux slice shape identical.
4. Replace `useRegistrationRealtime` to open a Socket.IO connection instead of a Supabase channel — same event shape.
5. Regenerate `src/integrations/supabase/types.ts` from Drizzle/Prisma output so all imports still resolve.

**Phase 9 — Emails**
Wire Nodemailer + Resend/SES. Reimplement templates for: email verification, password reset, welcome, milestone unlocked (optional), payment receipt.

**Phase 10 — Cron & background jobs**
- Nightly `expire_registrations()` sweep (already exists as SQL function).
- Strava periodic sync (replaces `strava-cron-sync`).
- Optional: order reconciliation with Razorpay.

**Phase 11 — Deploy on Railway**
- Services: `web` (Vite build served by Nginx or Railway static), `api` (Node/Express), `postgres` (Railway plugin), optional `redis` (rate-limit + BullMQ), `worker` (cron).
- Env vars set per §13.
- Update Razorpay + Strava callback URLs to the new API domain.

**Phase 12 — Cutover**
1. Freeze writes on Supabase.
2. Final `pg_dump` → restore to Railway.
3. Point DNS / `VITE_API_BASE_URL` to the new backend.
4. Verify: signup, login, book challenge, pay, log activity, milestone unlock notification, admin CRUD.
5. Decommission Supabase project after 30-day retention window.

### Architectural risks / notes

- **Password hashes**: Supabase's bcrypt hashes are portable; keep the `crypt()`/`bcrypt` verification in Node using the same rounds. If hashes are Argon2 (newer projects), install `argon2` — Node supports both.
- **RLS parity**: RLS is currently the last line of defence. In Express, the same rules must be enforced in middleware + query filters. Do not skip this — the current app assumes RLS is on.
- **RPCs remain SECURITY DEFINER** and continue to enforce ownership internally; keep calling them from Node.
- **Realtime**: only one screen uses it. LISTEN/NOTIFY from Postgres → Socket.IO is a 1-day job.
- **Storage URLs** stored in DB rows become invalid after migration; run a one-time SQL rewrite (`REPLACE(url, 'https://<ref>.supabase.co/storage/v1/…', '<new-cdn>')`).
- **Auth-related emails** are silently handled by Supabase today; forgetting SMTP setup will break password reset.

### Estimated effort

| Phase | Effort |
|---|---|
| 2. Data migration | 1–2 days |
| 3. Express skeleton + auth | 2–3 days |
| 4. API endpoints | 4–6 days |
| 5. Edge functions ported | 2 days |
| 6. Storage swap | 1–2 days |
| 7. Realtime (Socket.IO + LISTEN/NOTIFY) | 1 day |
| 8. Frontend façade + hooks swap | 2–3 days |
| 9. Emails | 1 day |
| 10. Cron jobs | 0.5 day |
| 11. Railway deploy | 0.5–1 day |
| 12. Cutover & QA | 1–2 days |
| **Total** | **~3 weeks (single engineer)** |

---

**End of Phase 1 Report — no code, config, DB, or dependencies were modified.**
