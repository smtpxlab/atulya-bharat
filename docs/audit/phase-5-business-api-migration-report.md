# Phase 5 — Business API Migration Report

**Status:** Complete. Frontend, Supabase compat shim, and Edge Functions untouched.
**Scope:** Explicit REST endpoints for 18 business domains under `/api/v1/*` on the
new Express backend. No route touches `src/` or `supabase/`.

---

## 1. APIs Created (by module)

All endpoints are mounted under `/api/v1`. Success envelope `{ "data": ... }`,
error envelope `{ "error": { code, message, details } }` (from `errorHandler.ts`).
Paginated lists return `{ items, page, pageSize, total }` inside `data`.

### Profiles — `/profiles`
- `GET /me` — current user's profile
- `PATCH /me` — update own profile (whitelisted columns)
- `GET /:id` — read single profile (auth)
- `GET /` — admin list, search by name/username

### User Roles — `/user-roles`
- `GET /me` — roles for current user
- `GET /?user_id=` — admin list
- `POST /` — admin assign role (idempotent on `(user_id, role)`)
- `DELETE /:id` — admin remove role

### Challenges — `/challenges`
- `GET /` — public list (only `is_active` for anon), search + status filter
- `GET /:idOrSlug` — detail
- `GET /:id/tickets` — challenge tickets sorted by price
- `GET /:id/leaderboard?limit=` — calls `public.challenge_leaderboard(id, limit)`
- `GET /:id/progress` — calls `public.challenge_progress(id, user_id)`
- `POST | PUT | DELETE /:id` — admin CRUD

### Registrations — `/registrations`
- `GET /mine` — user's registrations
- `GET /active` — calls `public.active_registration(user_id)`
- `GET /:id` — single (owner or admin)
- `POST /` — calls `public.register_for_challenge(...)`
- `POST /:id/cancel` — calls `public.cancel_active_registration(...)`
- `GET /` — admin list

### Milestones — `/milestones`
- `GET /?challenge_id=` — list, ordered by sort/unlock_at_km
- `GET /:id` — detail + `milestone_media[]`
- `POST | PUT | DELETE /:id` — admin CRUD

### Activity Logs — `/activities`
- `GET /mine?registration_id=` — user's logs
- `POST /` — calls `public.log_manual_activity(...)`
- `DELETE /:id` — owner-only for manual logs, admin for others
- `GET /` — admin list

### Orders — `/orders`
- `GET /mine` / `GET /:id` — owner + admin
- `POST /` — create pending order (payment provider wiring lands in Phase 7)
- `GET /` — admin list
- `GET /admin/stats` — calls `public.admin_booking_stats()`

### Coupons — `/coupons`
- `POST /validate` — calls `public.validate_coupon(code, amount)`
- `GET | POST | PUT | DELETE` — admin CRUD

### Blogs — `/blogs`
- `GET /` — anon sees only `status=published & is_published=true`
- `GET /slug/:slug` — public read
- `GET /:id` — admin only
- `POST | PUT | DELETE` — admin CRUD (author_id auto-set)

### CMS Pages — `/pages`
- `GET /` — anon sees only `status=enabled`
- `GET /slug/:slug` — public read
- `POST | PUT | DELETE` — admin CRUD

### Gallery — `/gallery`
- `GET /` — public list ordered by sort/upload
- `POST /` / `DELETE /:id` — admin

### FAQs — `/faqs`
- `GET /` — anon sees only `status=true`
- `POST | PUT | DELETE` — admin

### Testimonials — `/testimonials`
- `GET /` — public
- `POST | PUT | DELETE` — admin

### Notifications — `/notifications`
- `GET /` — public sees only published+active
- `GET /mine` — current user's `user_notifications`
- `POST /mine/:id/read` — mark read
- `POST | PUT | DELETE` — admin CRUD

### Clubs — `/clubs`
- `GET /` — anon uses `public.list_public_clubs()`; admin gets full table
- `GET /slug/:slug` — `public.get_public_club_by_slug(slug)`
- `GET /:id` — admin (base table + social_links)
- `POST /` — authenticated create (transactional insert of club + social_links)
- `PUT /:id` — admin update (social_links replace-all semantics preserved)
- `DELETE /:id` — admin
- `GET /:id/members` — `public.list_club_members(club_id)`
- `POST /:id/members` — self-join
- `DELETE /:id/members/:memberId` — self-leave or admin
- `GET /mine/list` — current user's memberships

### Newsletter — `/newsletter`
- `POST /subscribe` — `public.subscribe_to_newsletter(email, source)`
- `POST /unsubscribe` — direct table update
- `GET /` — admin list, filter by status
- `GET /stats` — total / active / unsubscribed / last-30-days counts

### Contact Enquiries — `/contact`
- `POST /` — public submit
- `GET /` / `GET /:id` / `DELETE /:id` — admin

---

## 2. Business Rules Migrated

- **Auth boundary** — every mutating endpoint explicitly requires `req.user`
  populated by JWT middleware; owner-vs-admin checks are done in code, never in
  `SET LOCAL` variables. RLS on Railway remains disabled (matches Phase 4
  architecture).
- **Visibility rules** — public-facing lists (challenges, blogs, pages, faqs,
  notifications) filter drafts/unpublished/disabled unless the caller has
  the `admin` role.
- **Domain functions reused verbatim** (no logic re-implemented on the app side):
  - `active_registration`, `register_for_challenge`, `cancel_active_registration`
  - `challenge_progress`, `challenge_leaderboard`
  - `log_manual_activity`
  - `validate_coupon`
  - `admin_booking_stats`
  - `list_public_clubs`, `get_public_club_by_slug`, `list_club_members`
  - `subscribe_to_newsletter`
- **Club create/update** wraps club + social_links in a transaction and preserves
  the "social_links replace-all" semantic from the admin API contract.
- **Manual-log deletion** enforces the same rule as before: owners can delete
  their manual logs only; Strava-sourced logs are admin-only.
- **Response format** is uniform: `{ data }` on success, `{ error }` on failure,
  `204` on empty deletes.

## 3. Modules Completed (18 / 18)

Profiles · User Roles · Challenges · Registrations · Milestones · Activity Logs ·
Orders · Coupons · Blogs · CMS Pages · Gallery · FAQs · Testimonials ·
Notifications · Clubs · Club Members · Newsletter · Contact Enquiries.

## 4. Remaining Modules (deferred to later phases, per plan)

- **Storage** (Cloudflare R2 uploads, signed URLs) — Phase 6.
- **Strava integration** (`/strava/*` — connect, sync, webhooks) — Phase 7.
- **Payments** (Razorpay order + verify + webhook) — Phase 7.
- **Edge Function replacements** (`contact-form`, `strava-*`,
  `create-razorpay-order`, `verify-razorpay-payment`, `razorpay-webhook`,
  `complete-mock-booking`) — Phase 7.
- **Admin dashboard aggregates** (`GET /admin/dashboard`, participant reports)
  — Phase 8 (uses `admin_list_challenge_participants`,
  `admin_challenge_participant_stats`).
- **Compatibility layer activation** — Phase 8.

## 5. Testing Report

- **Unit / contract tests carried over from Phase 4** (`auth.routes.test.ts`,
  `health.test.ts`) continue to pass.
- **New endpoints** were verified via TypeScript build and route mount checks.
  Full integration tests (schema-loaded Railway instance) run in Phase 6 once
  seed fixtures land — none of these endpoints run today because
  `DATABASE_URL` still points at an empty schema on the target.
- **Validation** — every write body is enforced with zod; malformed requests
  return `400 VALIDATION_ERROR` with a flattened detail tree.
- **Authorization** — `requireAuth` + `requireRole("admin")` middleware is
  exercised by the existing auth test harness.

## 6. Build Status

- `server/` TypeScript compiles clean (`tsgo` — no new errors).
- No runtime path in `src/` was touched; the classic Vite build is
  unaffected.

## 7. Files Created

- `server/src/utils/list.ts`
- `server/src/routes/profiles.routes.ts`
- `server/src/routes/user-roles.routes.ts`
- `server/src/routes/challenges.routes.ts`
- `server/src/routes/registrations.routes.ts`
- `server/src/routes/milestones.routes.ts`
- `server/src/routes/activities.routes.ts`
- `server/src/routes/orders.routes.ts`
- `server/src/routes/coupons.routes.ts`
- `server/src/routes/blogs.routes.ts`
- `server/src/routes/pages.routes.ts`
- `server/src/routes/gallery.routes.ts`
- `server/src/routes/faqs.routes.ts`
- `server/src/routes/testimonials.routes.ts`
- `server/src/routes/notifications.routes.ts`
- `server/src/routes/clubs.routes.ts`
- `server/src/routes/newsletter.routes.ts`
- `server/src/routes/contact.routes.ts`
- `docs/audit/phase-5-business-api-migration-report.md`

## 8. Files Modified

- `server/src/routes/index.ts` — mounts the 18 new routers under `/api/v1/*`.

## Confirmation

- No frontend files changed. Supabase client + shim remain the sole runtime
  path used by the app.
- Edge Functions untouched.
- Compatibility layer **not** activated.

**Awaiting approval before starting Phase 6 (Storage & Compatibility Layer).**
