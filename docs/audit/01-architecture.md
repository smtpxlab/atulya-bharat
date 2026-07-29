# 01 — Architecture Overview

## Current stack

| Layer | Technology | Location |
|---|---|---|
| UI | React 18 + Vite 5 + TypeScript 5 + Tailwind + shadcn/ui | `src/` |
| Routing | `react-router-dom` v6, lazy-loaded routes, `Suspense` | `src/App.tsx` |
| State (server) | `@tanstack/react-query` v5 | `src/main.tsx`, `src/features/*/hooks` |
| State (auth) | React Context (`useAuth`) | `src/hooks/useAuth.tsx` |
| Validation | `zod` schemas | `src/schemas/` |
| Service layer | Thin async wrappers, single `ServiceError` shape | `src/services/` |
| Backend | Lovable Cloud (Supabase) — Postgres + RLS + Edge Functions + Storage + Auth | `supabase/` |
| Monitoring | No-op wrapper, console-only in dev | `src/lib/monitoring/index.ts` |

## High-level architecture

See [`diagrams/architecture.mmd`](./diagrams/architecture.mmd).

```text
Browser
  └─ React app (Vite bundle, code-split per route)
        └─ React Router + Suspense
              ├─ AuthProvider (Context)            ← Supabase Auth session + user_roles
              ├─ QueryClientProvider               ← React Query cache
              └─ Route components
                    ├─ Feature hooks (Challenges only today)
                    │      └─ src/services/*  ──► supabase-js
                    └─ Direct supabase calls (Dashboard, Clubs, Blog, Gallery, Leaderboard, Contact, CreateClub, StravaCallback)

supabase-js
  ├─ PostgREST  ──► Postgres (RLS enforced) + RPCs
  ├─ Edge Functions: create-razorpay-order, verify-razorpay-payment,
  │                  strava-config, strava-connect, strava-sync-manual,
  │                  strava-webhook, strava-webhook-setup
  ├─ Storage: 6 buckets (club-logos public; rest private with public-read policies)
  └─ Auth: email/password + Google OAuth, JWT
```

## Data flow

See [`diagrams/data-flow.mmd`](./diagrams/data-flow.mmd).

1. Strava webhook (or manual sync) → `strava-sync-manual` edge function → ingests activity → inserts `activity_logs` for each matching active registration → increments `registrations.total_km_logged`.
2. **Currently the Dashboard does the same logic client-side** when a user logs a manual activity (`src/pages/Dashboard.tsx:217-260`). This is the largest correctness risk in the codebase.

## Authentication flow

See [`diagrams/auth-flow.mmd`](./diagrams/auth-flow.mmd).

```text
Login / Signup page
  └─ supabase.auth.signInWithPassword | signUp | signInWithOAuth(Google)
        └─ AuthProvider.onAuthStateChange
              ├─ setSession / setUser
              ├─ monitoring.identify(user.id)
              └─ fetchRoles(user.id) ──► public.user_roles SELECT
ProtectedRoute / AdminRoute / RoleRoute consume useAuth().{user, roles, isAdmin}
```

On signup, `handle_new_user()` trigger inserts a `profiles` row + a `user_roles` row with default `user`.

## Payment flow (Razorpay)

See [`diagrams/payment-flow.mmd`](./diagrams/payment-flow.mmd).

```text
RegistrationModal
  └─ useRegisterChallenge mutation
        └─ registrationService.registerForChallenge
              ├─ paymentService.createRazorpayOrder
              │    └─ edge: create-razorpay-order
              │         ├─ getClaims(jwt)  → userId
              │         ├─ SELECT challenge_tickets BY id  (server-trusted price)
              │         └─ POST https://api.razorpay.com/v1/orders
              ├─ Razorpay Checkout opens in browser
              └─ on success → paymentService.verifyRazorpayPayment
                                  └─ edge: verify-razorpay-payment   (NOT reviewed — see §07)
```

No webhook is currently configured for async outcomes (failed payments, refunds).

## Strava flow

See [`diagrams/strava-flow.mmd`](./diagrams/strava-flow.mmd).

```text
Dashboard → "Connect Strava"
  └─ edge: strava-config  (returns client_id)
  └─ window.location → strava.com/oauth/authorize
  └─ /auth/strava/callback → edge: strava-connect
        ├─ exchange code → tokens
        └─ service-role upsert into strava_tokens

Webhook path:
  Strava → edge: strava-webhook (verify_jwt = false)
        └─ enqueue / ingest activity   (verification of verify_token / HMAC: Needs verification)

Manual sync:
  Dashboard "Sync Strava" → edge: strava-sync-manual
        ├─ ensureFreshToken (refreshes if <60s to expiry)
        └─ ingestActivity (per matching active registration → activity_logs INSERT)
```
