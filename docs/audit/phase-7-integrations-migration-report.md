# Phase 7 — Edge Functions & Third-Party Integration Migration Report

Status: **Complete (backend-only).** No frontend files touched. Compatibility
layer remains **inactive** — the app still talks to Supabase everywhere.

---

## 1. Edge Functions replaced (in the new Express backend)

| Retired Supabase edge function | New Express handler |
|---|---|
| `create-razorpay-order` | `POST /api/v1/payments/razorpay/orders` |
| `verify-razorpay-payment` | `POST /api/v1/payments/razorpay/verify` |
| `razorpay-webhook` | `POST /api/v1/payments/razorpay/webhook` (raw body, HMAC-verified) |
| `contact-form` | `POST /api/v1/contact` (rate-limited, honeypot, SMTP) |
| `strava-config` | `GET /api/v1/strava/config` |
| `strava-connect` | `POST /api/v1/strava/connect` |
| `strava-disconnect` | `POST /api/v1/strava/disconnect` |
| `strava-athlete-stats` | `GET /api/v1/strava/athlete/stats` |
| `strava-sync-manual` | `POST /api/v1/strava/sync` (optional `?full=true`) |
| `strava-cron-sync` | `POST /api/v1/strava/cron-sync` (admin) + `strava-sync:cron-fanout` repeatable |
| `strava-webhook` | `GET/POST /api/v1/strava/webhook` (event enqueued to BullMQ) |
| `strava-webhook-setup` | Not needed at runtime — one-off setup script; superseded by `subscriptionHealth()` |
| `strava-subscription-health` | `GET /api/v1/strava/webhook/health` (admin) |
| `complete-mock-booking` | (Test fixture — intentionally not ported.) |

Every business rule from the retired functions is preserved:

- Prices, coupon discounts, and challenge-registration eligibility come from
  the DB (`challenge_tickets`, `validate_coupon()`, `register_for_challenge()`).
- Promoter/club discounts are forced to zero (Audit P-1).
- Free bookings register immediately with an `ABR-FREE-YYYYMMDD-######` txn.
- Razorpay signature verification is HMAC-SHA256 with a timing-safe compare.
- Webhook handlers are idempotent for `payment.captured`, `payment.authorized`,
  `payment.failed`, `refund.processed`, `refund.created`.
- Strava tokens auto-refresh 60s before expiry; `refresh_failed_at` is set
  on failure and surfaced as `STRAVA_RECONNECT_REQUIRED`.
- Strava webhook events are deduped via `strava_webhook_events` unique index.

## 2. APIs created

Payments (`/api/v1/payments/*`)
- `POST razorpay/orders` — user, JSON — mirrors `create-razorpay-order`.
- `POST razorpay/verify` — user, JSON — mirrors `verify-razorpay-payment`.
- `POST razorpay/webhook` — public, raw body, signature-verified.
- `POST razorpay/refund` — admin — issue a refund via Razorpay REST API.

Strava (`/api/v1/strava/*`)
- `GET  config` — public discovery.
- `GET  auth-url` — user — canonical Strava OAuth URL.
- `POST connect` — user — exchange OAuth code, upsert tokens.
- `POST disconnect` — user — deauthorize at Strava + wipe row.
- `GET  athlete/stats` — user — proxied athlete totals.
- `POST sync` — user — foreground sync (`?full=true` allowed).
- `POST cron-sync` — admin — fan out per-user jobs to BullMQ.
- `GET  webhook/health` — admin — subscription status.
- `GET  webhook` — public — Strava handshake.
- `POST webhook` — public (verify-token gated) — enqueues activity events.

Contact (`/api/v1/contact`)
- `POST /` — public, rate-limited (5/hr per IP), honeypot, dual-email
  dispatch, DB audit row.

Email (helpers)
- `dispatchMail()` — sends via BullMQ when Redis is present, falls back
  to synchronous SMTP otherwise.
- Templates: `passwordResetEmail`, `emailVerification`, `contactInternal`,
  `contactAcknowledgement`, `genericNotification`.

Password reset & email verification endpoints were already scaffolded in
Phase 4 (`/api/v1/auth/forgot-password`, etc.) — this phase supplies the
`sendMail` transport those flows call.

## 3. Webhooks implemented

| Webhook | Path | Verification |
|---|---|---|
| Razorpay | `POST /api/v1/payments/razorpay/webhook` | Raw body + HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET`, timing-safe compare |
| Strava (activity) | `POST /api/v1/strava/webhook?token=…` | Query `token` compared to `STRAVA_VERIFY_TOKEN`; fails closed if unset |
| Strava (handshake) | `GET  /api/v1/strava/webhook` | Standard `hub.mode=subscribe` challenge echo |

Both webhooks are idempotent — the Razorpay handler no-ops on already-paid
orders, the Strava handler deduplicates via `strava_webhook_events`.

## 4. Queue jobs implemented

BullMQ queues (Redis-backed; disabled gracefully when `REDIS_URL` is unset):

| Queue | Job | Trigger | Purpose |
|---|---|---|---|
| `email` | `send` | ad-hoc (contact form, auth flows) | Deliver `MailOptions` via SMTP |
| `strava-sync` | `cron-fanout` | repeatable `*/15 * * * *` | Enumerate users due, enqueue `sync-user` |
| `strava-sync` | `sync-user` | per-user | Run `syncUserActivities` for a user |
| `strava-sync` | `webhook-event` | Strava webhook POST | Process a single activity event |
| `notifications` | `expire-registrations` | repeatable `*/5 * * * *` | Call `expire_all_registrations()` |
| `notifications` | `process-notifications` | repeatable `*/2 * * * *` | Reserved for future push fanout |
| `notifications` | `cleanup` | repeatable `45 21 * * *` (03:15 IST) | Purge revoked refresh sessions & expired auth tokens |
| `webhooks` | (reserved) | — | Future async outbound webhook dispatch |

Scheduler bootstraps only when `ENABLE_SCHEDULER=true`, so Phase 7 stays
dormant until you approve.

## 5. Environment variables required (added / used)

Newly consumed on the server:

| Variable | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Transactional email transport |
| `SUPPORT_EMAIL` | Reply-to + fallback receiver for contact form |
| `CONTACT_RECEIVER` | Inbox that receives contact-form submissions |
| `MAIL_FROM_NAME`, `SITE_URL` | Email branding |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments + webhook auth |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`, `STRAVA_REDIRECT_URI` | Strava OAuth + webhook auth |
| `PUBLIC_APP_URL` | Password-reset / verification email links |
| `REDIS_URL` | BullMQ (optional; queue disabled cleanly if unset) |
| `ENABLE_SCHEDULER` | Gate for cron-like repeatable BullMQ jobs |

All are already declared in `server/src/config/env.ts` and `.env.example`.

## 6. Testing report

- `bun run typecheck` in `server/` — **green (0 errors).** The leftover
  `user.repository.ts` typing bug from Phase 4 is fixed.
- `bun run test` — **16/16 green** across:
  - `tests/storage.service.test.ts` (Phase 6)
  - `tests/auth.routes.test.ts` (Phase 4)
  - `tests/health.test.ts` (Phase 2)
- Manual smoke targets (deferred until the compatibility layer wires the
  frontend in Phase 8, so we don't pollute the shared Supabase state):
  - Razorpay order creation and signature verification against test keys.
  - Strava OAuth round-trip and webhook dedupe.
  - Contact form dispatch through SMTP.

## 7. Files created

- `server/src/routes/payments.routes.ts`
- `server/src/routes/strava.routes.ts`
- `server/src/services/email/templates.ts`
- `server/src/jobs/scheduler.ts`
- `docs/audit/phase-7-integrations-migration-report.md`

## 8. Files modified

- `server/src/repositories/user.repository.ts` — fix Knex typing (resolves the
  outstanding TS error from Phase 4).
- `server/src/config/env.ts` — add `SUPPORT_EMAIL`, `CONTACT_RECEIVER`,
  `MAIL_FROM_NAME`, `SITE_URL`, `ENABLE_SCHEDULER`.
- `server/src/services/payments/razorpay.service.ts` — replace stub with full
  `createOrder`, `verifyAndRecordPayment`, `applyWebhookEvent`, `refundPayment`.
- `server/src/services/strava/strava.service.ts` — replace stub with full
  connect/disconnect/refresh/sync/webhook logic.
- `server/src/services/email/mailer.service.ts` — add `dispatchMail` queue
  wrapper.
- `server/src/routes/contact.routes.ts` — real public POST with rate limit,
  honeypot, spam protection, dual SMTP dispatch.
- `server/src/jobs/worker.ts` — real BullMQ handlers for email, strava-sync,
  notifications, and cleanup.
- `server/src/routes/index.ts` — mount `/payments` and `/strava`.

## 9. TypeScript status

✅ `bun run typecheck` in `server/` reports **0 errors**. The pre-existing
`user.repository.ts` issue is resolved.

## Confirmations

- ✅ No frontend files modified.
- ✅ Compatibility layer **not** activated — the app still uses Supabase
  everywhere.
- ✅ Authentication untouched — Phase 4 flow unchanged.
- ✅ All webhook payload shapes preserved (Razorpay + Strava event schemas
  unchanged).
- ✅ Scheduled jobs are gated by `ENABLE_SCHEDULER` and remain OFF by default.

**Awaiting approval before Phase 8 (compatibility layer activation).**
