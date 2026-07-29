# 12 — Environment Variables Audit

Secret **values are never shown** in this document. Names only.

## Frontend (Vite — must be `VITE_*` to reach the bundle)

| Variable | Source | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (auto-managed) | `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` (auto-managed) | `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_PROJECT_ID` | `.env` (auto-managed) | informational |

No other `VITE_*` keys are read by the app today. Future additions (recommended):

| Variable | Purpose |
|---|---|
| `VITE_SENTRY_DSN` | Browser Sentry init |
| `VITE_POSTHOG_KEY` | Browser analytics |
| `VITE_POSTHOG_HOST` | Self-hosted PostHog URL |
| `VITE_SITE_URL` | Absolute URLs in `<SEO/>` canonical + sitemap |

## Supabase (managed by Lovable Cloud — set in Project Settings → Secrets)

| Variable | Purpose | Status |
|---|---|---|
| `SUPABASE_URL` | Edge functions | Set |
| `SUPABASE_ANON_KEY` | Edge functions (forward user JWT) | Set |
| `SUPABASE_PUBLISHABLE_KEY` | (publishable, mirrors anon in newer Supabase) | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions service-role client (Strava, future webhooks) | Set |
| `SUPABASE_DB_URL` | Migrations / psql | Set |

## Razorpay

| Variable | Purpose | Status |
|---|---|---|
| `RAZORPAY_KEY_ID` | Edge functions create-order + browser checkout (returned via order response) | Set |
| `RAZORPAY_KEY_SECRET` | Edge functions create-order; signature verification (must be in `verify-razorpay-payment`) | Set |
| `RAZORPAY_WEBHOOK_SECRET` *(missing)* | Signature verification on the future `razorpay-webhook` function | **Not set** |

## Strava

| Variable | Purpose | Status |
|---|---|---|
| `STRAVA_CLIENT_ID` | OAuth + token exchange + refresh | Set |
| `STRAVA_CLIENT_SECRET` | OAuth + token exchange + refresh | Set |
| `STRAVA_VERIFY_TOKEN` | Webhook subscription verification (GET handshake) | Set (in-code use needs verification) |

## AI / other

| Variable | Purpose | Status |
|---|---|---|
| `LOVABLE_API_KEY` | Lovable AI Gateway (not currently consumed by app code — reserved) | Set |

## Monitoring (recommended additions)

| Variable | Purpose | Status |
|---|---|---|
| `SENTRY_DSN` (Deno edge functions) | Server-side error reporting | **Not set** |
| `VITE_SENTRY_DSN` | Browser error reporting | **Not set** |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | Product analytics | **Not set** |

## Notes

- Lovable Cloud secrets cap: 100 per environment, currently using 11.
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` are not retrievable by the user via the dashboard on Lovable Cloud — keep operations that require them inside edge functions.
