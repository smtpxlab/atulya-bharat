# 14 — Node.js Backend Readiness

The team plans to introduce a dedicated Node.js API in the near future, ahead of a mobile app. The clean architectural way to do this is to keep the Node API as a **drop-in replacement for the service layer** — i.e. `src/services/*` calls become `fetch(API_URL + ...)` instead of `supabase.from(...)`. This audit confirms how ready the codebase is.

## Logic location inventory

### A. Business logic currently in React (should move out)

| Logic | Where today | Where it belongs |
|---|---|---|
| Milestone unlock on activity log | `src/pages/Dashboard.tsx:217-260` (JS, non-atomic) | **DB function** (preferred — atomic) OR Node API endpoint |
| `registrations.total_km_logged` recompute on manual log | `Dashboard.tsx` | Same as above |
| Determine which active registrations a Strava activity belongs to | `strava-sync-manual` edge function (✓ correct place) + (incorrectly duplicated in Dashboard for manual logs) | Edge function / Node API only |
| Compute progress % per challenge | Mixed: inline in `ChallengeDetail`, `Dashboard`, `Leaderboard` RPC | Reusable in `src/lib/progress.ts` shared between web + mobile |
| Activity mode validation (`run|walk|ride|any`) | Repeated in modal + sync function | Zod schema in `src/schemas/activity.schema.ts` (exists; ensure single source) |

### B. Business logic currently in edge functions (correct location today)

| Logic | Function |
|---|---|
| Server-trusted ticket pricing + Razorpay order creation | `create-razorpay-order` |
| Razorpay signature verification + order/registration activation | `verify-razorpay-payment` *(not reviewed)* |
| Strava OAuth code → token exchange | `strava-connect` |
| Strava token refresh + activity ingestion | `strava-sync-manual` |
| Strava webhook receive | `strava-webhook` |

These should move into the Node.js API or stay as thin proxies. The cleanest path is to have the Node API call Razorpay/Strava directly and keep edge functions for events that must hit a low-latency public endpoint (Strava webhook).

### C. Logic that should remain in Postgres + RLS

| Logic | Reason |
|---|---|
| Row visibility (ownership, club membership, public catalogue) | RLS is the safest enforcement boundary; Node API can ride the user's JWT and inherit it |
| Reference data joins (challenge_tickets, milestones) | Postgres-native joins are cheaper than orchestration |
| Aggregations (`global_leaderboard`, `challenge_leaderboard`, `hall_of_fame`) | Already SECURITY DEFINER RPCs — perfect; Node calls them via the same JWT |
| Atomic mutations (activity insert + total bump + milestone unlock) | Add a new SECURITY DEFINER function; call from Node or DB trigger |
| Constraints, FKs, uniqueness | DB-native, non-negotiable |

## Target architecture

See [`diagrams/architecture.mmd`](./diagrams/architecture.mmd) for the current shape, and below for the proposed target:

```text
┌─────────────┐   ┌─────────────┐   ┌─────────────────┐
│  Web (React)│   │ Admin (React)│   │ Mobile (RN/Flutter)
└──────┬──────┘   └──────┬──────┘   └────────┬────────┘
       │                 │                   │
       └────────┬────────┴───────────────────┘
                │  HTTPS (JWT bearer = Supabase access token)
                ▼
        ┌──────────────────┐
        │  Node.js API     │  (Fastify or NestJS)
        │  - Auth passthrough (verify JWT via Supabase JWKS)
        │  - Domain controllers (challenges, clubs, dashboard, ...)
        │  - Webhooks (Razorpay, Strava)
        │  - Business orchestration (atomic ops)
        │  - Background jobs (BullMQ / Redis) for sync, emails
        └────────┬─────────┘
                 │ supabase-js (service role) OR direct PG
                 ▼
            ┌──────────┐
            │ Postgres │ (Lovable Cloud) — RLS + RPCs + Storage
            └──────────┘
```

## Required Node.js API domains

| Domain | Endpoints (first cut) |
|---|---|
| Auth | `GET /me`, `POST /me/avatar`, `PATCH /me` (everything else stays in Supabase Auth) |
| Challenges | `GET /challenges`, `GET /challenges/:slug`, `GET /challenges/:slug/leaderboard` |
| Registrations | `POST /registrations` (calls Razorpay), `GET /me/registrations`, `POST /registrations/:id/verify-payment` |
| Activities | `POST /activities` (atomic), `GET /me/activities`, `DELETE /activities/:id` |
| Milestones | `GET /me/milestones`, `POST /milestones/:id/unlock` (admin) |
| Clubs | `GET /clubs`, `GET /clubs/:slug`, `POST /clubs`, `POST /clubs/:id/members`, `DELETE /clubs/:id/members/:userId` |
| Profiles | `GET /users/:id` (public bits), `PATCH /me` |
| Payments | `POST /webhooks/razorpay` (signature-verified) |
| Strava | `GET /strava/config`, `POST /strava/connect`, `POST /strava/sync`, `DELETE /strava`, `POST /webhooks/strava` |
| Blog (public) | `GET /posts`, `GET /posts/:slug`, `GET /tags` |
| Gallery (public) | `GET /gallery?challengeId=` |
| Contact | `POST /contact` |
| Admin (RBAC-gated) | `POST/PATCH/DELETE` for every resource above; `GET /admin/dashboard` |
| Notifications | `POST /me/devices`, internal job queue |

## Migration sequencing (suggested)

1. **First**: complete the in-app service-layer migration of the remaining 8 pages (Dashboard, Clubs, Blog, Gallery, Leaderboard, Contact, CreateClub, StravaCallback). Until this is done, swapping the backend means rewriting page-level code.
2. **Then**: stand up the Node API with the same shape as `src/services/*`. The fastest path is a Fastify app that proxies to `supabase-js` for reads + Postgres for writes; the SLA-critical Strava webhook can remain an edge function.
3. **Then**: change the Supabase client in `src/integrations/supabase/client.ts` to remain only for auth, and rewrite each service to call the Node API. Page code does not change.
4. **Then**: shift atomic operations (activity insert + milestone unlock, payment verification + registration activation) into Node controllers.

## Readiness checklist

| Item | Status |
|---|---|
| Clear layered architecture in app code | ✓ defined, ◐ adopted (Challenges only) |
| Single source of truth for domain types | ✓ `src/types/` |
| Single source of truth for validation | ✓ `src/schemas/` (Zod) — reusable in Node |
| Centralized service layer | ✓ |
| Centralized error shape | ✓ `ServiceError` |
| Centralized query keys | ✓ `qk` |
| Auth as JWT (Supabase Auth) | ✓ — Node can verify via JWKS |
| RLS as safety net | ✓ — Node will inherit user JWT or use service role with explicit checks |
| RBAC functions reusable in Node | ✓ — `is_admin`, `has_role` callable via RPC |
| Atomic activity operations | ✗ — needs DB function or Node controller before mobile launches |
| Notifications transport | ✗ — none |
| Email transport | ✗ — none |
