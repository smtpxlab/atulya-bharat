# 11 — Monitoring & Error Handling Audit

## What exists

| Piece | File | State |
|---|---|---|
| `monitoring` wrapper (singleton) | `src/lib/monitoring/index.ts` | **No-op scaffold** — `console.*` in dev only, no SDK |
| `monitoring.init()` | called in `src/main.tsx` | Wires nothing (returns early) |
| `monitoring.identify(userId, traits)` | called in `src/hooks/useAuth.tsx` on auth state change + sign-out | Console only |
| `monitoring.captureError(err, ctx)` | called in `src/components/ErrorBoundary.tsx`, `src/services/errors.ts` (indirectly) | Console only |
| `monitoring.captureMessage(msg, ctx)` | not currently called | — |
| `monitoring.trackEvent(name, props)` | called in `src/features/challenges/hooks/useRegisterChallenge.ts` (`challenge_registered`) | Console only |
| `ErrorBoundary` | `src/components/ErrorBoundary.tsx` | Class component, wraps app inside `AuthProvider` |
| `ServiceError` | `src/services/errors.ts` | Normalized shape; thrown by every service |
| React Query global error handler | `src/main.tsx` | **Not present** — query errors don't reach monitoring |
| Edge function structured logs | `supabase/functions/*` | Plain `console.error(...)` |

## Coverage gaps

| Surface | Today | Should be |
|---|---|---|
| Unhandled React render error | ErrorBoundary → console | Sentry breadcrumb + capture |
| React Query failed query | swallowed (user sees empty state / toast) | RQ `QueryCache.onError` → monitoring.captureError |
| React Query failed mutation | thrown to caller | RQ `MutationCache.onError` → monitoring.captureError |
| `window.onerror` / unhandledrejection | not wired | Sentry handles automatically |
| Edge function exception | `console.error` in Supabase logs | Sentry server SDK or at minimum a structured JSON log |
| User analytics events | only `challenge_registered` | Standard event taxonomy: signup, login, challenge_view, challenge_register_started, payment_succeeded, strava_connected, activity_logged, milestone_unlocked |
| Performance / Web Vitals | not collected | `web-vitals` → monitoring.trackEvent |

## Recommendations

1. Pick stack (suggested): **Sentry** for errors + tracing, **PostHog** or **Plausible** for product analytics. All three offer free tiers.
2. Replace the body of `src/lib/monitoring/index.ts`:
   - `init()` → `Sentry.init({ dsn: env.VITE_SENTRY_DSN, tracesSampleRate: 0.2 })` + `posthog.init(...)`
   - `captureError` → `Sentry.captureException`
   - `trackEvent` → `posthog.capture`
   - `identify` → both SDKs' `setUser` / `identify`
3. In `src/main.tsx`, wrap `new QueryClient({ ..., queryCache: new QueryCache({ onError: (err) => monitoring.captureError(err) }), mutationCache: new MutationCache({ onError: (err) => monitoring.captureError(err) }) })`.
4. Wrap every edge function body in a `try { ... } catch (e) { console.error(JSON.stringify({ fn, err: serializeError(e), userId })); throw e }` pattern; add Sentry Deno SDK when feasible.
5. Define the analytics event taxonomy in `src/lib/analytics-events.ts` so future code uses typed event names.
6. Add `noindex` for monitoring tools' debug routes if any are exposed.
