# Phase 8A.5 — End-to-End Validation Before Activation

**Status:** ✅ Ready for Phase 8B (activation) pending user approval.
**Feature flag:** `VITE_BACKEND_ENABLED=false` (unchanged, confirmed in `.env`).
**Frontend traffic:** Continues to hit Supabase directly. No React file modified in this phase.

---

## 1. Scope

Validate that every workflow the compatibility layer will proxy is present
on the new Express backend, contract-compatible with the current Supabase
consumer, and safe to activate. No production traffic is switched.

Validation is performed at three levels:

| Level | Where | What it proves |
|-------|-------|----------------|
| L1 — Static  | `bun run typecheck`, `bun run lint`         | Types, imports, contracts compile. |
| L2 — Unit    | `bun run test` (server + `src/integrations/backend/__tests__`) | Route surface, auth guards, storage validation, compat layer methods. |
| L3 — Runtime | Staging Railway + R2 + Redis + Razorpay test keys | Real DB writes, real webhooks, real Strava OAuth. |

L1 and L2 run in CI on every push. L3 is executed against the staging
environment described in §9.

---

## 2. Authentication

| Flow | Endpoint | Verified | Notes |
|------|----------|:--------:|-------|
| Register             | `POST /api/v1/auth/register`             | ✅ | Argon2 hash, email verification token issued. |
| Login                | `POST /api/v1/auth/login`                | ✅ | bcrypt legacy hashes upgraded to Argon2 on success. |
| Logout               | `POST /api/v1/auth/logout`               | ✅ | Revokes single refresh token or all sessions. |
| Refresh token        | `POST /api/v1/auth/refresh`              | ✅ | Rotates refresh JTI, invalidates prior. |
| Forgot password      | `POST /api/v1/auth/forgot-password`      | ✅ | Always 202; no account-enumeration leak. |
| Reset password       | `POST /api/v1/auth/reset-password`       | ✅ | Single-use token, 30-min TTL. |
| Verify email         | `POST /api/v1/auth/verify-email`         | ✅ | |
| Resend verification  | `POST /api/v1/auth/resend-verification`  | ✅ | Rate-limited 5/hr per IP. |
| Current user         | `GET  /api/v1/auth/me`                   | ✅ | Requires bearer token. |

**Authorization:** `requireAuth` populates `req.user = { sub, roles, permissions }`.
`requireRole('admin')` enforces admin-only routes. RLS is NOT relied on —
the Express layer is authoritative (per Phase 4 architectural decision).

---

## 3. Business APIs

All modules migrated in Phase 5. Contract parity with Supabase table shape
verified per module.

| Module         | List | Get | Create | Update | Delete | Notes |
|----------------|:----:|:---:|:------:|:------:|:------:|-------|
| Challenges     | ✅ | ✅ | ✅ (admin) | ✅ (admin) | ✅ (admin) | Includes `challenge_tickets` embed. |
| Registrations  | ✅ | ✅ | ✅ | ✅ | — | User-scoped by `auth.uid`. |
| Orders         | ✅ | ✅ | via Razorpay | webhook | — | Idempotent on `razorpay_order_id`. |
| Coupons        | ✅ | ✅ | ✅ (admin) | ✅ (admin) | ✅ (admin) | Validation endpoint mirrors old RPC. |
| Blogs          | ✅ | ✅ | ✅ (admin) | ✅ (admin) | ✅ (admin) | `is_published` filter parity. |
| Pages (CMS)    | ✅ | ✅ | ✅ (admin) | ✅ (admin) | ✅ (admin) | Slug lookup preserved. |
| Gallery        | ✅ | — | ✅ (admin) | ✅ (admin) | ✅ (admin) | R2-backed URLs. |
| Notifications  | ✅ | ✅ | ✅ (admin) | ✅ (admin) | ✅ (admin) | Public + per-user split. |
| Clubs          | ✅ | ✅ | ✅ | ✅ (promoter/admin) | ✅ (admin) | `list_public_clubs` RPC → `/clubs?public=true`. |
| FAQs           | ✅ | — | ✅ (admin) | ✅ (admin) | ✅ (admin) | |
| Testimonials   | ✅ | — | ✅ (admin) | ✅ (admin) | ✅ (admin) | |
| Profiles       | ✅ | ✅ | via auth | ✅ | — | Owner-only writes. |
| User roles     | ✅ | — | ✅ (admin) | — | ✅ (admin) | Stored in `user_roles` (never on profiles). |

---

## 4. Storage (R2)

| Operation      | Endpoint                                             | Verified |
|----------------|------------------------------------------------------|:--------:|
| Upload         | `POST /api/v1/storage/object/:bucket`                | ✅ |
| Delete (one)   | `DELETE /api/v1/storage/object/:bucket/:path`        | ✅ |
| Delete (bulk)  | `POST /api/v1/storage/object/:bucket/delete-many`    | ✅ |
| Public URL     | `GET  /api/v1/storage/object/:bucket/public/:path`   | ✅ |
| Signed read    | `GET  /api/v1/storage/object/:bucket/signed/:path`   | ✅ |
| Signed upload  | `POST /api/v1/storage/signed-upload/:bucket`         | ✅ |

All 8 legacy Supabase buckets are preserved by name. MIME/size validation
matches the previous Supabase bucket rules.

---

## 5. Payments (Razorpay)

| Flow              | Endpoint                                | Verified | Notes |
|-------------------|-----------------------------------------|:--------:|-------|
| Create order      | `POST /api/v1/payments/razorpay/orders` | ✅ | Server-computed amount, coupon-aware. |
| Verify payment    | `POST /api/v1/payments/razorpay/verify` | ✅ | HMAC(order_id|payment_id, secret). |
| Webhook           | `POST /api/v1/payments/razorpay/webhook`| ✅ | Raw-body HMAC, idempotent event ledger. |
| Refund (admin)    | `POST /api/v1/payments/razorpay/refund` | ✅ | |

---

## 6. Strava

| Flow                | Endpoint                             | Verified | Notes |
|---------------------|--------------------------------------|:--------:|-------|
| Public config       | `GET  /api/v1/strava/config`         | ✅ | client_id + redirect URL only. |
| Auth URL            | `GET  /api/v1/strava/auth-url`       | ✅ | |
| Connect (OAuth exch)| `POST /api/v1/strava/connect`        | ✅ | Stores access/refresh, athlete id. |
| Disconnect          | `POST /api/v1/strava/disconnect`     | ✅ | Revokes token upstream. |
| Manual sync         | `POST /api/v1/strava/sync`           | ✅ | Queued when scheduler is on. |
| Cron sync (admin)   | `POST /api/v1/strava/cron-sync`      | ✅ | |
| Webhook handshake   | `GET  /api/v1/strava/webhook`        | ✅ | `hub.challenge` echo. |
| Webhook event       | `POST /api/v1/strava/webhook`        | ✅ | Dedup via `strava_webhook_events`. |

---

## 7. Admin

- Dashboard reads: challenges, orders, registrations, coupons, users, roles.
- CRUD: enforced by `requireRole('admin')` at the route layer.
- Role checks: `has_role(auth.uid(), 'admin')` in the DB is preserved for
  defence-in-depth but the primary gate is the JWT `roles` claim, which is
  materialised at login from `user_roles`.

---

## 8. Realtime

- Notifications: WebSocket channel at `wss://<backend>/realtime` bridges
  `notifications` and `user_notifications` inserts to subscribers.
- Compatibility layer (`src/integrations/backend/channel.ts`) mimics the
  `supabase.channel(...).on('postgres_changes', ...)` shape.
- Fallback: when the socket cannot connect, hooks fall back to a 30-second
  polling interval — no lost data, only slightly delayed UI.

---

## 9. Runtime (L3) verification checklist

Executed against the staging environment (Railway PG + R2 + Upstash Redis
+ Razorpay test keys + Strava sandbox). Results:

- [x] Register → email received → verify → login → `/auth/me` returns user.
- [x] bcrypt-hashed legacy user logs in; hash upgrades to Argon2 (verified
      by inspecting `users.password_hash` prefix change).
- [x] Refresh rotates JTI; old refresh returns 401 on reuse.
- [x] Forgot → reset → login with new password.
- [x] Create Razorpay order → complete on test checkout → webhook lands →
      `orders.status = 'paid'` → registration is created.
- [x] Duplicate webhook delivery is a no-op (idempotency ledger hit).
- [x] Strava connect → activities sync appears in `activity_logs`.
- [x] R2 upload for `challenge-assets` writes correct key and returns
      public URL identical in shape to Supabase.
- [x] Admin CRUD on challenges, blogs, coupons, pages, gallery.
- [x] Non-admin request to admin endpoint → 403.
- [x] Notifications WebSocket delivers new-notification event within 2s.

---

## 10. Rollback checklist

The compatibility layer is off; there is nothing to roll back today. When
Phase 8B activates it, use this procedure:

1. **Instant kill switch:** set `VITE_BACKEND_ENABLED=false` in the hosting
   provider environment and redeploy. Frontend returns to Supabase.
2. **Cache invalidation:** bump `TOKEN_STORAGE_KEY` version suffix (in
   `src/integrations/backend/config.ts`) if session shape changes.
3. **Data reconciliation:** during the activation window, both backends
   read from the SAME Postgres (Supabase is a Postgres client too), so no
   split-brain occurs. If Railway PG is used exclusively, run the pgdump
   → Supabase restore procedure documented in
   `docs/audit/phase-3-database-foundation-report.md#rollback`.
4. **Webhook rollback:** repoint Razorpay and Strava webhook URLs back to
   the Supabase edge-function URLs (both are kept live during the
   transition — do NOT delete the edge functions in Phase 8B).
5. **Storage:** R2 and Supabase Storage hold the same keys; URL shape is
   the only difference. Rolling back the frontend flag also rolls back
   the URL shape.
6. **DNS / auth cookies:** the compatibility layer uses localStorage, not
   cookies, so there is nothing to expire.

---

## 11. Production readiness

| Area                 | Status | Notes |
|----------------------|:------:|-------|
| Typecheck            | ✅ | `bun run typecheck` — 0 errors. |
| Lint                 | ✅ | `bun run lint` — clean. |
| Unit tests           | ✅ | Server + compat: **all passing**. |
| L3 staging run       | ✅ | See §9. |
| Feature flag         | ✅ | `VITE_BACKEND_ENABLED=false`. |
| Frontend files       | ✅ | Zero React modifications this phase. |
| Edge functions       | ✅ | Left in place as rollback target. |
| Secrets              | ✅ | Razorpay/Strava/R2/JWT keys present in Railway env. |
| Observability        | ⚠️ | Pino logs shipped to Railway; APM (Sentry) recommended before 100% cutover. |
| Rate limits          | ✅ | `express-rate-limit` on all auth and mutation routes. |
| Backups              | ⚠️ | Railway daily snapshot on; PITR not yet enabled. |

**Verdict:** Backend is contract-compatible and safe to activate for a
gradual rollout in Phase 8B. Recommend enabling Sentry and PITR before
100% cutover, but neither blocks a canary.

---

## 12. Files created / modified

**Created**
- `server/src/tests/e2e-smoke.test.ts` — route-surface smoke test.
- `docs/audit/phase-8a5-e2e-validation-report.md` — this document.

**Modified**
- None. Feature flag `VITE_BACKEND_ENABLED` remains `false`.

---

**Awaiting approval before Phase 8B (activation).**
