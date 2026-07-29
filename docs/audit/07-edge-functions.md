# 07 — Edge Functions Audit

7 functions deployed under `supabase/functions/`.

## Per-function

### 1. `create-razorpay-order`
- **Purpose:** create a Razorpay order for a `challenge_ticket` purchase.
- **Auth:** required. Validates `Bearer` token via `supabase.auth.getClaims(jwt)`. ✓
- **Input:** `{ challenge_id, ticket_id }`. Validated as strings.
- **Server-trusted pricing:** SELECT `price_inr` FROM `challenge_tickets` WHERE id AND challenge_id matches. ✓ (never trusts client amount)
- **Secrets used:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- **Output:** `{ order_id, amount, currency, key_id, ticket_name }`.
- **Risks:** none significant. Could add Zod validation on input and HMAC the receipt.

### 2. `verify-razorpay-payment`
- **Status: NOT REVIEWED in this audit.**
- Expected to verify the `razorpay_signature` HMAC, mark `orders.status = 'paid'`, create / activate the `registrations` row.
- **Action:** open `supabase/functions/verify-razorpay-payment/index.ts` and confirm:
  - `razorpay_signature = hmac_sha256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)` check
  - DB writes are wrapped in service-role client
  - Failure path leaves order in `failed` not silently succeeds

### 3. `strava-config`
- **Purpose:** expose `STRAVA_CLIENT_ID` (public OAuth client id) to the browser.
- **Auth:** **none** (`verify_jwt = false` in `supabase/config.toml`). Acceptable — no secret leak.
- **Risks:** none.

### 4. `strava-connect`
- **Purpose:** exchange OAuth `code` for tokens, upsert into `strava_tokens`.
- **Auth:** required, `getUser()` resolves the calling user.
- **Service-role usage:** yes (upsert bypasses RLS edge cases on `ON CONFLICT user_id`).
- **Secrets used:** `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Input validation:** type check on `code`.
- **Risks:** none significant.

### 5. `strava-sync-manual`
- **Purpose:** refresh user's Strava token if needed, fetch any new activities, write to `activity_logs` for each active registration whose `activity_mode` is compatible.
- **Auth:** required. (`getUser()` — verified up to truncation; confirm full file.)
- **Service-role usage:** yes (`admin` client used for token refresh + activity insert).
- **Token refresh:** ✓ — `ensureFreshToken` rotates when <60s to expiry.
- **Idempotency:** ✓ — selects existing `(user_id, strava_activity_id)` before insert.
- **Risks:**
  - **No DB-level UNIQUE constraint** on `(user_id, strava_activity_id)` — a race between manual sync and webhook can double-insert.
  - **Does not update `registrations.total_km_logged`** in the snippet read (truncated) — confirm.
  - **Does not unlock milestones** — Dashboard JS does it after manual log only.

### 6. `strava-webhook`
- **Purpose:** receive Strava activity events.
- **Auth:** disabled (`verify_jwt = false`) — required by Strava.
- **In-code verification:** **`Needs verification`** — confirm:
  - GET: returns `hub.challenge` only when `hub.verify_token == STRAVA_VERIFY_TOKEN`.
  - POST: HMAC check or at minimum reject unknown `owner_id`s.
- **Risks:** without verify-token / signature check, anyone can forge activity events.

### 7. `strava-webhook-setup`
- **Purpose:** one-off helper to register/unregister the Strava webhook subscription.
- **Auth:** assumed admin-only. **`Needs verification`** — confirm `is_admin(getUser().id)` check.

## Cross-cutting

| Concern | Status |
|---|---|
| CORS | All return `Access-Control-Allow-Origin: *`. Acceptable for browser-callable functions; consider tightening `verify-razorpay-payment` to the production origin. |
| Structured logs | None — uses `console.error(msg, err)`. Plain text only. |
| Error responses | Plain JSON `{ error: string }` with HTTP status; no error code taxonomy. |
| Rate limiting | None at the function layer. |
| Idempotency keys | None on `create-razorpay-order`. Razorpay's `receipt` field acts as a partial dedupe. |
| Webhook signature verification | Razorpay: **not present** (no webhook endpoint exists). Strava: **`Needs verification`**. |

## Missing functions (recommended)

| Function | Reason |
|---|---|
| `razorpay-webhook` | Capture async events: `payment.failed`, `payment.captured`, `refund.processed`. Without it, `orders.status` can drift from reality. |
| `log-activity` | Atomic replacement for the Dashboard JS path (insert activity + bump total + unlock milestones). |
| `admin-create-challenge` (or DB upsert through service-role from a Node API later) | Enables Admin CMS without granting client-side write access. |
