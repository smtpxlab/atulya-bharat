# Phase 1.5 — Final Replacement Architecture (Design Only)

**Status:** Design for approval. No code, no config, no dependency changes.
**Scope:** Remove Lovable Cloud / Supabase entirely. Keep the React SPA (public site + Admin Panel) byte-identical in behavior and appearance. Replace the backend with Node.js + Express on Railway, Postgres on Railway, Cloudflare R2 for storage, Socket.IO for realtime, and SMTP for email.

The single most important design decision below is **§ 4 — the Supabase Compatibility Layer**. It is the reason the 54 Supabase-dependent frontend files do not need to be edited.

---

## 1. High-Level Target Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                          │
│  Public pages · Auth pages · Dashboard · Admin Panel (unchanged UI)  │
│                                                                      │
│  import { supabase } from "@/integrations/supabase/client"           │
│                    │                                                 │
│                    ▼                                                 │
│      ┌───────────────────────────────────┐                           │
│      │  Supabase Compatibility Shim      │  (§4)                     │
│      │  .auth  .from  .rpc  .functions   │                           │
│      │  .storage  .channel  (realtime)   │                           │
│      └──────────────┬────────────────────┘                           │
└─────────────────────┼────────────────────────────────────────────────┘
                      │ HTTPS  (Bearer JWT)   +   WSS (Socket.IO)
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Node.js 20 + Express API (Railway)                │
│  Versioned routes /api/v1/*                                          │
│  Middlewares: requestId · logger · cors · helmet · rateLimit ·       │
│               auth(JWT) · rbac · zodValidate · errorHandler          │
│                                                                      │
│  Controllers → Services → Repositories → Postgres (pg + Knex)        │
│  Adapters: R2 (S3 SDK) · Razorpay · Strava · SMTP (nodemailer)       │
│  Realtime: Socket.IO server (Redis adapter for scale)                │
│  Jobs: BullMQ (Redis) — cron, webhooks retry, email, strava sync     │
└──────┬──────────────────────────────┬───────────────────────────────┘
       │                              │
       ▼                              ▼
┌───────────────┐              ┌──────────────────┐
│  Postgres 15  │              │  Redis (Railway) │
│  (Railway)    │              │  BullMQ + SIO    │
│  Same schema  │              └──────────────────┘
│  RLS OFF (API │
│  is the guard)│              ┌──────────────────┐
└───────────────┘              │  Cloudflare R2   │  (S3-compatible)
                               │  Buckets mirror  │
                               │  Supabase names  │
                               └──────────────────┘
       External: Razorpay · Strava · SMTP provider (SES/Resend/etc.)
```

---

## 2. Guiding Principles

1. **Contract-preserving**: the shim exposes the same method signatures, return shapes, and error semantics the app already consumes. Frontend code is untouched.
2. **Schema-preserving**: table names, columns, enums, and RPC names remain identical. RPCs become REST endpoints under `/rpc/<name>` returning the same JSON.
3. **Security-by-API**: Postgres RLS is disabled (or advisory only). Authorization is enforced in Express middleware + service layer. Every RLS rule has an equivalent policy check in code.
4. **Progressive migration**: cutover is a DNS/env-var switch, with feature-flagged dual-write windows for orders and activity_logs.
5. **Observability first**: every request has a correlation id, every job has a run record, every external call is retried with jitter.

---

## 3. Folder Structure

### 3.1 Frontend (unchanged tree; only `src/integrations/supabase/*` is rewritten)
```
src/
  integrations/
    supabase/
      client.ts         ← shim entry (public surface)
      shim/
        auth.ts         ← .auth.*
        query.ts        ← .from(...).select/insert/update/delete/eq/...
        rpc.ts          ← .rpc(name, args)
        functions.ts    ← .functions.invoke(name, {body})
        storage.ts      ← .storage.from(bucket).*
        realtime.ts     ← .channel(...).on('postgres_changes',...)
        http.ts         ← fetch wrapper, token refresh, retry
        errors.ts       ← PostgrestError-shaped error mapper
        types.ts        ← re-export of existing generated types
```
No other frontend file changes.

### 3.2 Backend (new repo or `/server` folder)
```
server/
  src/
    app.ts                    ← express app factory
    server.ts                 ← http + socket.io bootstrap
    config/
      env.ts                  ← zod-validated env
      db.ts, redis.ts, r2.ts, smtp.ts, razorpay.ts, strava.ts
    http/
      router.ts               ← mounts /api/v1
      middleware/
        requestId.ts logger.ts cors.ts helmet.ts rateLimit.ts
        auth.ts rbac.ts validate.ts errorHandler.ts notFound.ts
      v1/
        auth.routes.ts        profile.routes.ts
        challenges.routes.ts  registrations.routes.ts
        activities.routes.ts  milestones.routes.ts
        clubs.routes.ts       clubMembers.routes.ts
        blog.routes.ts        gallery.routes.ts   faqs.routes.ts
        pages.routes.ts       testimonials.routes.ts
        newsletter.routes.ts  contact.routes.ts   notifications.routes.ts
        coupons.routes.ts     orders.routes.ts    payments.routes.ts
        strava.routes.ts      admin.routes.ts     rpc.routes.ts
        storage.routes.ts     webhooks.routes.ts
    modules/                  ← domain modules (service + repo + schema)
      auth/         { auth.service.ts jwt.ts password.ts sessions.repo.ts }
      users/        { user.service.ts user.repo.ts profile.repo.ts roles.repo.ts }
      challenges/   { challenge.service.ts challenge.repo.ts ticket.repo.ts milestone.repo.ts }
      registrations/{ registration.service.ts registration.repo.ts bib.ts certificate.ts }
      activities/   { activity.service.ts activity.repo.ts progress.ts }
      clubs/        { club.service.ts club.repo.ts member.repo.ts }
      content/      { blog.* gallery.* faqs.* pages.* testimonials.* }
      newsletter/   { newsletter.service.ts newsletter.repo.ts }
      contact/      { contact.service.ts contact.repo.ts }
      notifications/{ notification.service.ts notification.repo.ts push.ts }
      coupons/      { coupon.service.ts coupon.repo.ts }
      payments/     { order.service.ts order.repo.ts razorpay.adapter.ts webhook.service.ts }
      strava/       { strava.service.ts token.repo.ts sync.service.ts webhook.service.ts classify.ts }
      storage/      { storage.service.ts r2.adapter.ts signer.ts }
      admin/        { admin.service.ts stats.service.ts audit.repo.ts }
    realtime/
      io.ts                   ← Socket.IO server
      channels.ts             ← room naming: user:<id>, reg:<id>, admin
      bridge.ts               ← LISTEN/NOTIFY → socket emit
    jobs/
      queue.ts                ← BullMQ setup
      workers/
        strava-cron-sync.worker.ts
        strava-sync-user.worker.ts
        email.worker.ts
        webhook-retry.worker.ts
        cleanup.worker.ts
      schedulers/
        cron.ts               ← every 15m strava sync, nightly expire, etc.
    email/
      mailer.ts               ← nodemailer transport
      templates/              ← MJML/Handlebars: welcome, reset, receipt,
                                 completion, milestone, contact-notify
      renderer.ts
    lib/
      logger.ts (pino)  errors.ts (AppError + Postgrest-shaped mapper)
      pagination.ts     query-builder.ts   crypto.ts   idempotency.ts
      zod-schemas/*     openapi.ts
    db/
      pool.ts (pg)     knex.ts     migrations/*   seeds/*
  tests/                       ← vitest / supertest
  Dockerfile   railway.json    package.json   tsconfig.json
```

### 3.3 Shared
```
packages/shared-types/         ← zod schemas + TS types imported by both apps
```

---

## 4. Supabase Compatibility Layer (the linchpin)

Goal: keep `import { supabase } from "@/integrations/supabase/client"` working with the exact call shapes the app already uses.

### 4.1 Public surface to re-implement
Mined from the current codebase (see `docs/audit/04-service-layer.md` and `docs/interview/api-reference.md`):

| Supabase call | Shim behavior |
|---|---|
| `supabase.auth.signInWithPassword({email,password})` | `POST /api/v1/auth/login` → stores `{access_token, refresh_token, user}` in `localStorage` under the same key the app reads today; fires `onAuthStateChange('SIGNED_IN')`. |
| `supabase.auth.signUp(...)` | `POST /api/v1/auth/signup` (email/password, optional metadata). |
| `supabase.auth.signInWithOAuth({provider:'google'})` | Redirect to `/api/v1/auth/oauth/google/start`; callback lands on `/auth/callback` and hydrates the same localStorage session. |
| `supabase.auth.signOut()` | `POST /api/v1/auth/logout`; clears storage; fires `SIGNED_OUT`. |
| `supabase.auth.getSession/getUser/onAuthStateChange` | Reads from an in-memory `SessionStore` backed by localStorage; auto-refreshes via `POST /auth/refresh` before expiry. |
| `supabase.auth.resetPasswordForEmail / updateUser` | `POST /auth/forgot`, `POST /auth/reset`, `PATCH /auth/me`. |
| `supabase.from('table').select(...).eq(...).order(...).range(...)` | A tiny query builder that serializes to `GET /api/v1/tables/:table?select=&filter=eq.col.val&order=col.desc&range=0-19`. The Express table router applies allow-listed columns and per-table policies. Returns `{ data, error, count }`. |
| `.insert / .update / .delete / .upsert` | `POST/PATCH/DELETE /api/v1/tables/:table` with the same body shape; server enforces write policies. |
| `.single()` / `.maybeSingle()` | Client-side unwrap; mirrors PostgREST behavior including `PGRST116` when 0 rows. |
| `supabase.rpc('fn_name', args)` | `POST /api/v1/rpc/:fn` — response body is the same JSON the SQL function returned today (`challenge_progress`, `challenge_leaderboard`, `global_leaderboard`, `hall_of_fame`, `list_public_clubs`, `has_role`, etc.). |
| `supabase.functions.invoke('name', {body})` | `POST /api/v1/functions/:name` — same names as today (`create-razorpay-order`, `verify-razorpay-payment`, `strava-connect`, `strava-sync-manual`, `contact-form`, ...). |
| `supabase.storage.from('bucket').upload/getPublicUrl/createSignedUrl/remove/list` | Proxied to R2 via `POST /api/v1/storage/:bucket/*`. Public buckets return CDN URLs; private buckets return short-lived signed URLs. Bucket names preserved. |
| `supabase.channel('x').on('postgres_changes', {table,filter}, cb).subscribe()` | Wraps a Socket.IO client. Server bridges Postgres `LISTEN/NOTIFY` (from triggers) to rooms `table:<name>:filter:<hash>`. Payload emitted with `{eventType, new, old}` matching Supabase's shape. |

### 4.2 Error shape
The shim returns `{ data, error }` where `error` is `{ message, code, details, hint }` — the same object shape `PostgrestError` uses today, so `if (error) throw ...` paths keep working.

### 4.3 What the shim does NOT try to emulate
- Arbitrary PostgREST embed strings (`select=col,other(*)`). The audit shows current usage stays within simple `select('col1,col2')` plus explicit joins done through RPCs. If a call uses an embed the shim can't parse, it forwards to an allow-listed `/api/v1/views/:name` endpoint we build on demand.
- Direct DB channels other than `postgres_changes` (none used today).

### 4.4 Result
- **Zero frontend edits** except the `src/integrations/supabase/*` shim implementation.
- All 54 files identified in Phase 1 keep compiling and behaving.
- Admin Panel (`src/features/admin/*`) rides on the same shim.

---

## 5. Backend Modules

Each module = `service.ts` (business rules) + `*.repo.ts` (SQL via Knex) + `*.schema.ts` (Zod).

| Module | Responsibility | Notes |
|---|---|---|
| auth | signup, login, logout, refresh, forgot/reset, OAuth (Google), email verification | Argon2id password hashing. Access token 15 min, refresh 30 days rotating, stored hashed in `auth_sessions` table. |
| users | profiles, roles (`app_role`), `has_role`/`is_admin`/`is_super_admin` equivalents | Roles stay in `user_roles` table with the same enum. |
| challenges | challenges CRUD, tickets, milestones | Public list cached in Redis 60s. |
| registrations | create, cancel, expire, bib assignment, certificate assignment | Bib/cert sequences kept in Postgres. |
| activities | manual log, Strava ingest, atomic total + milestone unlock | Wrapped in a single transaction with `SELECT ... FOR UPDATE` on the registration row. |
| clubs | clubs CRUD, membership, ownership guard, member counts | Recompute member_count via trigger *or* transactional update. |
| content | blog, gallery, faqs, pages, testimonials | Editorial CRUD gated by admin RBAC. |
| newsletter | subscribe/unsubscribe with dedupe | |
| contact | contact form intake + admin notification email | |
| notifications | in-app notifications table + Socket.IO push | Optional web-push later. |
| coupons | validate, redeem, atomic usage counter | |
| payments | orders ledger, Razorpay order creation, signature verification, webhook | Idempotency keys on all writes. |
| strava | OAuth exchange, token refresh, manual sync, webhook receive, sync run journal | BullMQ worker performs the actual sync. |
| storage | signed upload URLs, signed download URLs, delete | R2 via S3 SDK. |
| admin | dashboards, stats RPCs, participant lists, force-complete, audit log | RBAC = `admin` or `super_admin`. |

---

## 6. REST API (v1)

Base: `https://api.<domain>/api/v1`. All requests carry `Authorization: Bearer <access_token>` unless marked public.

### 6.1 Auth
```
POST   /auth/signup                     public
POST   /auth/login                      public
POST   /auth/logout
POST   /auth/refresh                    public (uses refresh token cookie/body)
POST   /auth/forgot                     public
POST   /auth/reset                      public (token)
GET    /auth/oauth/google/start         public → 302
GET    /auth/oauth/google/callback      public → 302 back to app
GET    /auth/me
PATCH  /auth/me
```

### 6.2 Domain (mirrors current pages)
```
GET    /challenges                          public
GET    /challenges/:slug                    public
GET    /challenges/:slug/tickets            public
GET    /challenges/:slug/milestones         public
GET    /challenges/:slug/leaderboard        public

POST   /registrations                       (creates registration + order)
GET    /registrations/me
GET    /registrations/:id
POST   /registrations/:id/cancel
POST   /registrations/:id/verify-payment

POST   /activities                          (atomic: log + total + unlocks)
GET    /activities?registrationId=
DELETE /activities/:id

GET    /clubs                               public
GET    /clubs/:slug                         public
POST   /clubs
PATCH  /clubs/:id
GET    /clubs/:id/members
POST   /clubs/:id/members
DELETE /clubs/:id/members/:userId

GET    /blog?...                            public
GET    /blog/:slug                          public
GET    /gallery?challengeId=                public
GET    /faqs                                public
GET    /pages/:slug                         public
GET    /testimonials                        public

POST   /newsletter/subscribe                public
POST   /contact                             public (rate-limited)

GET    /notifications
POST   /notifications/:id/read
POST   /notifications/read-all

POST   /coupons/validate
```

### 6.3 Payments
```
POST   /payments/razorpay/order
POST   /payments/razorpay/verify
POST   /webhooks/razorpay                   public, HMAC-verified
```

### 6.4 Strava
```
GET    /strava/config                       public (client id only)
POST   /strava/connect
POST   /strava/disconnect
POST   /strava/sync                         (enqueues BullMQ job, returns runId)
GET    /strava/sync/runs
GET    /strava/subscription/health          admin
POST   /webhooks/strava                     public, verify_token / subscription id
```

### 6.5 Admin
```
GET    /admin/dashboard
GET    /admin/challenges/:id/participants
GET    /admin/challenges/:id/participant-stats
GET    /admin/orders?...
POST   /admin/registrations/:id/force-complete
CRUD   /admin/{challenges,tickets,milestones,clubs,blog,gallery,faqs,pages,
              testimonials,coupons,payment-gateways,users,roles}
```

### 6.6 Shim-facing endpoints (used by the compat layer)
```
GET    /tables/:table            generic PostgREST-like read
POST   /tables/:table
PATCH  /tables/:table
DELETE /tables/:table
POST   /rpc/:name                mirrors supabase.rpc
POST   /functions/:name          mirrors edge functions
POST   /storage/:bucket/sign-upload
POST   /storage/:bucket/sign-download
DELETE /storage/:bucket/object
```
Each generic endpoint has a hard allow-list per table (columns readable/writable, filter columns, joins) driven by a `tableAccess.ts` config — this is where former RLS becomes explicit code.

### 6.7 Conventions
- Pagination: `?page=1&pageSize=20` or `?range=0-19` (shim uses range).
- Sorting: `?sort=col.asc,col2.desc`.
- Errors: `{ error: { code, message, details, hint } }`, HTTP status accurate.
- Idempotency: `Idempotency-Key` header honored on POSTs that create money-side effects.

---

## 7. Middleware Stack (order matters)

1. `requestId` — attach `x-request-id`.
2. `pinoHttp` — structured logs.
3. `helmet`, `cors` (allow-list origins), `compression`.
4. `rateLimit` — Redis-backed; stricter buckets for `/auth/*`, `/contact`, `/webhooks/*`.
5. `bodyParser` (JSON + raw for webhook signature routes).
6. `auth` — verifies JWT; attaches `req.user`. Public routes opt out via `router.public()`.
7. `rbac(role|policyFn)` — coarse (role) + fine (resource ownership) checks.
8. `validate(zodSchema)` — body / query / params.
9. Route handler → service → repo.
10. `notFound`, `errorHandler` — maps `AppError`, `ZodError`, `pg` errors to Postgrest-shaped JSON.

---

## 8. Authentication Flow

```
Browser                     Shim                  Express API             Postgres
  │ signInWithPassword(...)   │                       │                       │
  │──────────────────────────▶│  POST /auth/login     │                       │
  │                           │──────────────────────▶│ argon2 verify         │
  │                           │                       │──────────────────────▶│
  │                           │                       │◀──user row────────────│
  │                           │                       │ mint access+refresh   │
  │                           │◀──{tokens,user}───────│                       │
  │  save localStorage        │                       │                       │
  │  fire onAuthStateChange   │                       │                       │
  │                                                                            
  │ later: any authed call                                                     
  │──────────────────────────▶│  Authorization: Bearer <access>                
  │                           │  on 401 → POST /auth/refresh with refresh tok  
  │                           │  retries original request                      
```

- **Access token**: JWT (HS256 with `JWT_SECRET`, or RS256 with JWKS if we want mobile parity). Claims: `sub`, `email`, `roles[]`, `exp` (15 min), `iat`, `jti`.
- **Refresh token**: opaque 256-bit random, hashed (SHA-256) in `auth_sessions(user_id, token_hash, device, ip, expires_at, revoked_at)`; rotated on every use.
- **Storage on the client**: same `localStorage` key the current code inspects, wrapped by the shim.
- **OAuth Google**: standard authorization code + PKCE; server exchanges code, upserts profile, mints same tokens.
- **Password reset**: signed token (JWT, 30 min, single-use via `password_reset_tokens` table).
- **Email verify** (optional): flag on `profiles.email_verified_at`.

---

## 9. Role & Permission Flow

- Roles table `user_roles(user_id, role app_role)` — identical to today. Enum: `user | admin | super_admin` (+ any existing).
- Login response includes `roles[]`. `AuthProvider` on the frontend is unchanged because the shim returns the same object shape.
- Backend enforcement:
  - `requireAuth` middleware for anything non-public.
  - `requireRole('admin', 'super_admin')` for admin routes.
  - **Resource policies** in service layer: e.g., `assertRegistrationOwnership(user, regId)`, `assertClubOwner(user, clubId)`. This is where the current RLS predicates live in code.
- A single `policies/` folder documents every rule with a matching Vitest.

---

## 10. Database Flow

- Schema is a `pg_dump --schema-only` of the current `public` schema, minus `auth.*` and `storage.*` (those are replaced by our own `auth_sessions`, `password_reset_tokens`, `email_verifications`, and app-owned uploads metadata).
- **RLS disabled** on Railway; policies live in Express. A `db/policies.md` document maps each old policy to the new middleware/service check for audit.
- **RPCs** kept as SQL functions where they are pure aggregates (`global_leaderboard`, `hall_of_fame`, `challenge_leaderboard`, `_registration_logged_km`, etc.). Called from services with `pool.query('SELECT * FROM public.xxx($1,$2)', [...])`.
- **Triggers kept**: `handle_new_user` becomes an app-level transaction after signup instead. Data-integrity triggers (`guard_non_negative_distance`, `guard_activity_log_registration`, `orders_block_delete`, bib/certificate sequences, `notify_*`) are **retained** because they are DB invariants.
- Migrations managed by Knex; the first migration is the imported schema; subsequent migrations own all future changes.

```
Controller ── validate ──▶ Service ──▶ Repository ──▶ pg pool ──▶ Postgres
                              │
                              └──▶ external adapter (R2/Razorpay/Strava/SMTP)
                              └──▶ realtime bridge (LISTEN/NOTIFY → Socket.IO)
```

---

## 11. Storage Flow (Cloudflare R2)

Buckets: same names as today (`avatars`, `challenge-covers`, `gallery`, `blog`, `milestone-media`, `participation-photos`, `certificates`, ...).

- **Upload (private)**:
  1. Shim call `storage.from(bucket).upload(path, file)`.
  2. Shim calls `POST /storage/:bucket/sign-upload` → server returns pre-signed PUT URL (5 min).
  3. Browser PUTs directly to R2.
  4. Shim then `POST /storage/:bucket/finalize` so we can record the object in `storage_objects` and enforce quotas.
- **Public read**: `getPublicUrl` returns `https://cdn.<domain>/<bucket>/<key>` fronted by Cloudflare.
- **Private read**: `createSignedUrl(path, ttl)` → server signs a GET URL.
- **Delete**: server-authorized only.
- All keys namespaced by `user_id/` where applicable; server enforces ownership.

---

## 12. Notification Architecture

- Persistence: existing `user_notifications` and `notifications` tables kept.
- Realtime: Socket.IO. On login the shim opens a WS and joins room `user:<id>`. Admin joins `admin`.
- Trigger path: DB triggers (`notify_milestone_unlocked`, `notify_challenge_completed`) fire `pg_notify('user_notifications', row_json)`. A **Realtime Bridge** in the API subscribes with `LISTEN`, and re-emits into the right Socket.IO room in the exact Supabase Realtime payload shape.
- Optional email fan-out via BullMQ `email.worker`.
- Optional web-push later: `push_subscriptions` table, Web Push protocol.

---

## 13. Payment Architecture (Razorpay)

```
Checkout page
   │ create order  ──▶  POST /payments/razorpay/order
                          │ validate ticket + coupon
                          │ compute price server-side
                          │ INSERT orders (status='created', idempotency_key)
                          │ Razorpay Orders API
                          ▼
                       {razorpay_order_id, amount, key_id}
   │ user pays via Razorpay Checkout                        
   │ verify ──▶  POST /payments/razorpay/verify            
                  │ HMAC(order_id|payment_id, secret) == signature
                  │ UPDATE orders SET status='paid', paid_at=now()
                  │ INSERT registrations (trigger assigns bib)
                  │ enqueue email.receipt
                  ▼
Async safety net:
  Razorpay → POST /webhooks/razorpay (signed with RAZORPAY_WEBHOOK_SECRET)
    → idempotent: only writes if orders.status != 'paid'
```
- All amounts are server-computed; client never sends price.
- `orders` remains an immutable ledger (`orders_block_delete` trigger preserved).
- Refunds handled via a dedicated `POST /admin/orders/:id/refund` + Razorpay refunds API + webhook.

---

## 14. Strava Integration

- **Config**: `GET /strava/config` returns public client id (unchanged).
- **Connect**: `POST /strava/connect` exchanges code, upserts `strava_tokens` (refresh token encrypted at rest with `TOKEN_ENC_KEY` via AES-GCM).
- **Manual sync**: `POST /strava/sync` inserts a `strava_sync_runs` row and enqueues `strava-sync-user` job. The job:
  1. Refreshes token if <60s to expiry.
  2. Fetches recent activities.
  3. For each activity: calls the `ingest_strava_activity(user_id, jsonb)` SQL function (already atomic with milestone unlock) — kept as-is.
  4. Updates the sync run row; emits `user:<id>` socket event.
- **Webhook**: `POST /webhooks/strava` verifies `hub.verify_token` on GET; on POST enqueues `strava-webhook` job. Idempotent on `(owner_id, object_id, event_time)`.
- **Cron safety net**: BullMQ scheduler runs every 15 minutes, iterating users with stale `last_sync_at`, mirroring the current `strava-cron-sync`.

---

## 15. Email System (SMTP)

- Transport: Nodemailer over SMTP (Amazon SES / Resend / Postmark — env-selectable).
- Templates: MJML compiled at build time, rendered with Handlebars.
- Types: welcome, email-verify, password-reset, payment-receipt, challenge-completed, milestone-unlocked (opt-in), contact-form-notify (admin), newsletter-confirm.
- Delivery via `email.worker` (BullMQ) with retry (5 attempts, exponential backoff) and dead-letter queue.
- Bounce/complaint webhook endpoint if provider supports it.

---

## 16. Cron Jobs (BullMQ scheduler)

| Schedule | Job | Purpose |
|---|---|---|
| every 15 min | `strava-cron-sync` | Pull activities for connected users missed by webhook. |
| every 5 min | `webhook-retry` | Retry failed webhook processing. |
| hourly | `registrations-expire` | Runs `expire_registrations()`. |
| daily 02:00 IST | `db-vacuum-analyze` (advisory) | Maintenance signal. |
| daily 03:00 IST | `strava-subscription-health` | Ping Strava, update `strava_subscription_health`. |
| weekly | `newsletter-digest` (optional) | Placeholder. |

---

## 17. Logging

- `pino` with pretty transport in dev, JSON in prod.
- Every request logs: `request_id, user_id, route, status, latency_ms`.
- Every job logs: `job_id, name, attempt, duration, result`.
- External calls (Razorpay/Strava/SMTP) wrapped with a `withExternal(name, fn)` helper that records timing and error class.
- Log sink: Railway's log stream + optional Better Stack / Logtail / Axiom.

---

## 18. Error Handling Strategy

- `AppError(code, httpStatus, message, details?)` base class.
- Domain errors: `NotFoundError`, `ValidationError`, `AuthError`, `ForbiddenError`, `ConflictError`, `RateLimitError`, `UpstreamError`.
- Central `errorHandler` middleware:
  1. Maps `AppError` → HTTP + Postgrest-shaped body.
  2. Maps `ZodError` → 400 with `details.fieldErrors`.
  3. Maps known `pg` error codes (`23505` unique, `23503` FK, `23514` check) → 409/400 with friendly message.
  4. Falls back to 500 with `request_id`; full stack logged, never sent to client.
- Frontend keeps its existing `{ data, error }` handling because the shim rebuilds the shape.

---

## 19. API Versioning

- URL-based: `/api/v1/*`. `/api/health` and `/api/version` unversioned.
- Backwards compatibility rule: within a major, only additive changes. Breaking changes → `/api/v2/*` served in parallel for ≥ 90 days.
- Shim pins to a version constant. Mobile clients (future) get the same versioning.
- OpenAPI 3 spec generated from Zod schemas via `zod-to-openapi`, published at `/api/v1/openapi.json`.

---

## 20. Deployment Architecture (Railway)

Services in one Railway project:

| Service | Type | Notes |
|---|---|---|
| `web` | Static site | Vite build of the React app. Alternately keep on current host. |
| `api` | Node service | Express + Socket.IO, autoscale 1-3, health `/api/health`. |
| `worker` | Node service | BullMQ workers + cron scheduler. Same image as `api`, different start command. |
| `postgres` | Railway PG 15 | Daily backups, PITR. |
| `redis` | Railway Redis | For BullMQ + rate limiter + Socket.IO adapter. |

External:
- **Cloudflare R2** for object storage; Cloudflare CDN in front of public buckets and the SPA.
- **Razorpay**, **Strava**, **SMTP provider** — outbound only, plus webhook inbound on `api`.

Env vars (backend):
```
NODE_ENV, PORT, PUBLIC_APP_URL, API_BASE_URL
DATABASE_URL, DATABASE_SSL
REDIS_URL
JWT_SECRET (or JWT_PRIVATE_KEY/PUBLIC_KEY), JWT_ISSUER, JWT_AUDIENCE
REFRESH_TOKEN_PEPPER
TOKEN_ENC_KEY               # for encrypting Strava refresh tokens
CORS_ALLOWED_ORIGINS
GOOGLE_OAUTH_CLIENT_ID/SECRET, GOOGLE_OAUTH_REDIRECT_URI
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_PREFIX, R2_PUBLIC_BASE_URL
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_VERIFY_TOKEN
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
SENTRY_DSN (optional), LOG_LEVEL
```

Env vars (frontend, replaces the two Supabase ones):
```
VITE_API_BASE_URL=https://api.<domain>/api/v1
VITE_WS_BASE_URL=wss://api.<domain>
VITE_PUBLIC_CDN_URL=https://cdn.<domain>
```

Deployment diagram:
```
                     ┌──────────────────────┐
   users ───▶ CDN ───▶  web (Vite static)   │
                     └──────────┬───────────┘
                                │ /api, /socket.io
                                ▼
                     ┌──────────────────────┐
                     │  api (Express+SIO)   │──▶ Postgres
                     │  Railway autoscale   │──▶ Redis
                     └──────────┬───────────┘──▶ R2
                                │ enqueue
                                ▼
                     ┌──────────────────────┐
                     │  worker (BullMQ)     │──▶ Postgres/Redis/R2
                     │  cron + jobs         │──▶ Strava/Razorpay/SMTP
                     └──────────────────────┘
```

---

## 21. Migration Strategy

Executed in five stages; each stage is independently reversible.

**Stage A — Prep (no user impact)**
1. Provision Railway services + R2 buckets + Cloudflare.
2. `pg_dump` current schema + data into Railway Postgres. Verify row counts and foreign keys.
3. Copy all storage objects from current buckets → R2 (rclone / aws s3 sync with the R2 endpoint). Keep keys identical.
4. Stand up `api` + `worker` in **shadow mode** (no traffic).

**Stage B — Auth data**
5. Export users: `id, email, password hash (bcrypt), created_at, metadata, providers`. Import into new `auth_users`/`profiles`.
6. Because the existing password hashes are bcrypt-compatible, the new API can verify them on first login and lazily re-hash to Argon2id. No user needs a password reset.
7. For Google OAuth users: identity map is preserved via `provider_accounts(user_id, provider, provider_user_id)`.

**Stage C — Shim rollout behind a flag**
8. Implement the compat shim in `src/integrations/supabase/client.ts` (this file becomes locally maintained, not auto-generated).
9. Runtime flag `VITE_BACKEND=new|legacy` selects the shim vs the current Supabase SDK. Deploy to staging with `new`.
10. Full regression: public pages, auth, checkout, Strava, admin.

**Stage D — Cutover**
11. Freeze writes to Lovable Cloud (short read-only window ~10 min).
12. Final delta sync: rows written in the freeze window are `INSERT ... ON CONFLICT DO NOTHING` copied.
13. Flip DNS: `api.<domain>` → Railway; frontend deployed with `VITE_BACKEND=new`.
14. Watch dashboards for 24h.

**Stage E — Decommission**
15. After 7 days of clean operation, revoke Supabase keys, archive the project, delete buckets.

---

## 22. Rollback Strategy

Every stage has an explicit rollback:

| Stage | Detection | Rollback |
|---|---|---|
| A | Schema mismatch, row-count diff | Discard Railway PG; restart import. Zero user impact. |
| B | Login failure rate > 1% in staging | Fix mapping; re-import. Legacy still live. |
| C | Regression in staging | Flip `VITE_BACKEND=legacy`; redeploy frontend. |
| D | Elevated 5xx, payment failures, Strava sync errors during 24h watch | 1) Flip frontend flag back to `legacy`. 2) Revert DNS for `api.<domain>`. 3) Reverse-sync any new rows written on Railway back to Lovable Cloud using the same `ON CONFLICT` script (kept ready). |
| E | — | Not applicable after decommission; keep an encrypted snapshot for 90 days as insurance. |

Additional guardrails:
- **Dual-write window (optional)** for `orders` and `activity_logs` during Stage D via a small proxy — makes rollback loss-free.
- **Read-only mode** toggle on the API: a single env var flips all mutating routes to 503 to freeze state during cutover.
- **Backups**: Railway PG PITR + nightly logical dumps to R2. R2 buckets versioned.

---

## 23. Risks & Open Questions (for approval)

1. **RLS → app enforcement** is the largest surface. The mitigation is the `policies/` folder with 1:1 mapping and dedicated tests. Approval needed.
2. **Generic `/tables/:table` endpoint** is convenient for the shim but must be strictly allow-listed to avoid becoming a soft PostgREST. Confirm the allow-list approach.
3. **Password hashing**: verify bcrypt then upgrade to Argon2id lazily on first login — confirm acceptable.
4. **Realtime**: current usage is limited to a few `postgres_changes` subscriptions (registrations, notifications). Confirm no additional channels are added before cutover.
5. **Sequences (bib/certificate)** — keep Postgres sequences to preserve numbering continuity.
6. **Region**: pick Railway region closest to users (Singapore/Mumbai) to minimize DB latency for the India audience.

---

## 24. What Approval of This Document Unlocks

On approval, the next phases would be:
- **Phase 2**: implement the shim + Express skeleton + auth + one vertical slice (Challenges) end-to-end.
- **Phase 3**: port remaining modules in dependency order (users → registrations → activities → payments → strava → admin → content).
- **Phase 4**: migration rehearsal on staging, then production cutover per §21.

No code has been generated. No project files were modified in producing this document.
