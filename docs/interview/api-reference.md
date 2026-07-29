# Atulya Bharat Run — API Reference

Every callable server-side surface: 15 Edge Functions (Deno, in `supabase/functions/`) and 28 SQL routines (in `public` schema).

All Edge Functions are invoked from the browser via `supabase.functions.invoke('<name>', { body })`. JWT is automatically attached from the current session (except public functions like `contact-form`, `strava-webhook`, `razorpay-webhook`).

---

## Edge Functions

### Payments

#### `POST /create-razorpay-order`
- **Auth**: user JWT required.
- **Body**: `{ challengeId, ticketId, couponCode?, addressId }`
- **Logic**:
  1. Resolve `challenge_tickets.price` server-side (never trust client price).
  2. Apply coupon if valid (checks `coupons.max_uses`, `expires_at`, `active`).
  3. Insert `orders` row with `status='created'`.
  4. Call Razorpay `POST /v1/orders` using the active `payment_gateways` row.
  5. Return `{ orderId, razorpayOrderId, keyId, amount }`.
- **Errors**: 400 invalid coupon, 404 ticket/challenge, 502 Razorpay upstream.

#### `POST /verify-razorpay-payment`
- **Auth**: user JWT.
- **Body**: `{ orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }`
- **Logic**:
  1. HMAC-SHA256(`order_id|payment_id`, `key_secret`) — reject if mismatch.
  2. Update `orders.status='paid'`, stamp `paid_at`.
  3. Insert `registrations` row (trigger `registrations_assign_bib` fires).
- **Errors**: 401 signature mismatch, 409 already verified.

#### `POST /razorpay-webhook` *(public, signed)*
- **Auth**: none — verifies `X-Razorpay-Signature` header against `RAZORPAY_WEBHOOK_SECRET`.
- **Logic**: idempotent safety-net for missed browser confirmations. Same DB writes as `verify-razorpay-payment`; guarded by `orders.status != 'paid'`.

#### `POST /complete-mock-booking` *(dev only)*
- **Auth**: user JWT.
- **Logic**: creates a paid `orders` row + `registrations` row without hitting Razorpay. Used for QA and staging.

---

### Strava

#### `POST /strava-connect`
- **Auth**: user JWT.
- **Body**: `{ code, redirectUri }`
- **Logic**: exchanges OAuth code with Strava, upserts `strava_tokens` (encrypted refresh token stored in DB).

#### `POST /strava-disconnect`
- **Auth**: user JWT.
- **Logic**: revokes the token at Strava, deletes `strava_tokens` row, keeps historic `activity_logs`.

#### `POST /strava-sync-manual`
- **Auth**: user JWT.
- **Logic**: pulls last N activities for the user, filters by sport (registration mode: Run/Ride/Walk), inserts into `activity_logs` with UPSERT on `strava_activity_id` for idempotency. Returns `{ checked, imported, alreadyImported, outsideWindow, skippedSport }`.

#### `POST /strava-cron-sync`
- **Auth**: `CRON_SECRET` header.
- **Trigger**: pg_cron every 15 minutes.
- **Logic**: safety-net poller for users whose webhook was missed (Strava downtime, subscription lag).

#### `POST /strava-webhook` *(public)*
- **Auth**: verifies `hub.challenge` on GET (subscription handshake), matches subscription_id on POST.
- **Logic**: `{aspect_type, object_id, owner_id}` → fetch full activity → filter sport → insert `activity_logs`.

#### `POST /strava-webhook-setup`
- **Auth**: admin only.
- **Logic**: registers/unregisters the webhook subscription with Strava; writes `strava_subscription_health`.

#### `GET /strava-config` / `GET /strava-athlete-stats` / `GET /strava-subscription-health`
- Read-only telemetry endpoints used by Admin ➜ Strava dashboard.

---

### Content

#### `POST /contact-form` *(public)*
- **Auth**: none; rate-limited by IP inside function.
- **Logic**: Zod-validate → insert `contact_enquiries` → send SMTP notification to admin.

---

## SQL Routines (`public` schema)

`DEFINER` = SECURITY DEFINER (runs as owner, bypasses RLS by design). `INVOKER` = respects caller's RLS.

### RPCs called from the client
| Name | Purpose |
|------|---------|
| `challenge_progress(reg_id)` | Aggregated distance + % + remaining for a registration. |
| `challenge_leaderboard(challenge_id, limit)` | Top participants by total km. |
| `global_leaderboard(period, limit)` | Cross-challenge leaderboard. |
| `hall_of_fame(limit)` | Homepage "Hall of Fame" section. |
| `list_public_clubs(...)` | Public clubs listing (bypasses RLS for public read). |
| `get_public_club_by_slug(slug)` | Club detail (public read). |
| `list_club_members(club_id)` | Member roster (respects visibility). |
| `admin_list_challenge_participants(challenge_id)` | Admin table. |
| `admin_challenge_participant_stats(challenge_id)` | Counts, revenue. |
| `admin_booking_stats(...)` | Admin bookings dashboard. |
| `subscribe_to_newsletter(email)` | Public write with dedupe. |
| `has_role(user_id, role)` | Used by every admin RLS policy. |

### Triggers (auto-fire)
| Name | Fires on | Purpose |
|------|----------|---------|
| `activity_logs_sync_registration_total` | AFTER INSERT/UPDATE/DELETE `activity_logs` | Recomputes `registrations.total_distance_km`, marks completion, inserts `user_milestones` when thresholds crossed. |
| `registrations_assign_bib` | BEFORE INSERT `registrations` | Generates unique BIB number. |
| `registrations_assign_certificate` | BEFORE UPDATE `registrations` | Stamps certificate ID on completion. |
| `notify_challenge_completed` / `notify_milestone_unlocked` | AFTER UPDATE | Inserts into `user_notifications` (drives realtime bell). |
| `clubs_seed_owner_member` | AFTER INSERT `clubs` | Adds creator to `club_members` as owner. |
| `club_members_block_last_owner_delete` | BEFORE DELETE `club_members` | Prevents orphaned clubs. |
| `recompute_club_member_count` | AFTER INSERT/DELETE `club_members` | Maintains denormalized count. |
| `orders_assign_booking_number` | BEFORE INSERT `orders` | Sequential booking number. |
| `orders_block_delete` | BEFORE DELETE `orders` | Audit safety. |
| `payment_gateways_block_active_delete` | BEFORE DELETE `payment_gateways` | Prevents deleting the live gateway. |
| `payment_gateways_stamp_enabled` | BEFORE UPDATE | Stamps `enabled_at`. |
| `guard_activity_log_registration` | BEFORE INSERT `activity_logs` | Rejects activities for other users' registrations. |
| `guard_non_negative_distance` | BEFORE INSERT/UPDATE | Prevents negative km bugs. |
| `guard_registration_status_transition` | BEFORE UPDATE `registrations` | Enforces valid FSM: `active → completed`, no going back. |

### Guard/utility
- `_registration_logged_km(reg_id)` — internal aggregation helper.
- `_activity_type_matches_mode(activity_type, mode)` — sport ↔ challenge mode filter (Run only, etc.).
