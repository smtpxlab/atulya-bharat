# Railway — Single Service Deployment (Frontend + Admin + API + Postgres)

One Railway **service** runs everything. The Express server (`/server`) serves the
API at `/api/v1/*` **and** the compiled Vite SPA (public site + `/admin`) from the
same process and same domain. No Supabase, no Lovable Cloud, no second service.

```
Railway project
├── web            ← this repo, root Dockerfile  (SPA + API in ONE container)
├── Postgres       ← Railway plugin (data)
└── Redis          ← Railway plugin (optional: queues/rate-limit)
```

Postgres/Redis are *plugins*, not services you build — so you still only deploy
one app service.

## Why one service works now

- `Dockerfile` (repo root) — stage 1 builds the frontend, stage 2 builds the API,
  stage 3 ships both in one image (`dist/` = API, `client/` = SPA).
- `server/src/app.ts` — serves `client/` statically with SPA history fallback for
  deep links and `/admin/*`, while `/api/v1/*` stays JSON (404s included).
- Same-origin means no CORS setup and the HTTP-only refresh cookie
  (`abr_rt`, SameSite=Lax) just works.

The old `server/Dockerfile` + `server/railway.json` remain for an API-only
deployment. Ignore them for single-service.

## Step by step

### 1. Create the project
1. Railway → **New Project → Deploy from GitHub repo** → pick this repo.
2. Service **Settings → Build**: Builder = `Dockerfile`, Dockerfile path = `Dockerfile`
   (root — *not* `server/Dockerfile`), Root directory = `/`.
3. **Settings → Networking → Generate Domain** (or attach `atulyabharatrun.com`).

### 2. Add the database
1. **+ New → Database → PostgreSQL**.
2. **+ New → Database → Redis** (optional but recommended).

### 3. Load the schema
From your machine, using the Railway Postgres connection string:

```bash
psql "$RAILWAY_DATABASE_URL" -f atulya-bharat-schema.sql   # or server/src/models/sql/*.sql
```

If you use the canonical files instead, run in this order:
`tables.sql → indexes.sql → functions.sql → triggers.sql → grants.sql`.

RLS policies in the dump are harmless leftovers — authorization is now enforced
in Express middleware, and the API connects as the owner role.

### 4. Import data
Export from Lovable Cloud (**Cloud → Advanced settings → Export data**), then load
in FK order:

```
profiles → user_roles → clubs → club_members → challenges → challenge_tickets
→ challenge_milestones → milestone_media → registrations → orders
→ activity_logs → user_milestones → blog_posts → pages → faqs → testimonials
→ gallery_images → coupons → notifications → newsletter_subscribers
```

Password hashes cannot be exported from managed auth — every existing user must
reset their password once (Stage: forced reset, already built).

### 5. Run IAM migrations
Adds `login_attempts`, `user_devices`, `audit_logs`, `refresh_sessions`:

```bash
cd server && DATABASE_URL="$RAILWAY_DATABASE_URL" npm run migrate:latest
```

### 6. Variables

**Build variables** (baked into the SPA at build time — set these as
Railway *variables*; the Dockerfile reads them as build args):

| Variable | Value |
|---|---|
| `VITE_BACKEND_ENABLED` | `true` |
| `VITE_BACKEND_URL` | *(empty — same origin)* |
| `VITE_BACKEND_API_PREFIX` | `/api/v1` |

Leave the `VITE_SUPABASE_*` vars unset; with the flag on, the compatibility layer
routes everything to your own API.

**Runtime variables:**

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `8000` (Railway injects its own; keep it referenced) |
| `SERVE_CLIENT` | `true` |
| `CLIENT_DIST_DIR` | `client` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `DATABASE_SSL` | `true` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `JWT_ACCESS_SECRET` | 64-char random |
| `JWT_REFRESH_SECRET` | 64-char random (different) |
| `COOKIE_SECRET` | 64-char random |
| `COOKIE_SAMESITE` | `lax` (same-origin now) |
| `COOKIE_SECURE` | `true` |
| `CORS_ORIGINS` | your domain (unused same-origin, keep tight) |
| `PUBLIC_APP_URL` / `SITE_URL` | `https://yourdomain.com` |
| `ENABLE_SCHEDULER` | `true` (cron jobs run in-process — no worker service) |
| `SMTP_HOST/PORT/USER/PASS/FROM` | your mail provider |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET/PUBLIC_BASE_URL` | Cloudflare R2 |
| `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET` | Razorpay |
| `STRAVA_CLIENT_ID/CLIENT_SECRET/VERIFY_TOKEN/REDIRECT_URI` | Strava |

Generate secrets with `openssl rand -hex 32`.

### 7. Point third parties at the new domain
- Razorpay webhook → `https://yourdomain.com/api/v1/payments/razorpay/webhook`
- Strava callback → `https://yourdomain.com/api/v1/strava/callback`
  (and the same value in `STRAVA_REDIRECT_URI`)
- Strava webhook → `https://yourdomain.com/api/v1/strava/webhook`

### 8. Promote your admin
```sql
insert into user_roles (user_id, role)
select id, 'super_admin' from profiles where email = 'you@example.com';
```

### 9. Deploy and verify
1. `https://yourdomain.com/api/v1/health` → `ok`, db `true`, redis `true`.
2. Open `https://yourdomain.com` → DevTools **Network**: every XHR must hit
   `/api/v1/*` on your own domain. Any call to `*.supabase.co` means
   `VITE_BACKEND_ENABLED` was not set as a **build** variable — rebuild, don't
   just restart.
3. Reset your password, sign in, load `/admin` and `/admin/users`.
4. Hard-refresh a deep link (e.g. `/admin/challenges`) → must render, not 404
   (SPA fallback).

## Do I ever need a second service?

Only if traffic grows enough that background jobs should not share CPU with web
requests. Then add a second service from the *same* image with
`ENABLE_SCHEDULER=false` on `web` and start command `node dist/jobs/worker.js`.
Not required to launch.

## Common issues

| Symptom | Cause |
|---|---|
| Site loads, calls go to `supabase.co` | `VITE_BACKEND_ENABLED` set as runtime, not build, variable |
| Deep link 404s | Built with `SERVE_CLIENT=false`, or `client/` missing from image |
| 401 right after login | `COOKIE_SECURE=true` on a non-HTTPS domain, or `COOKIE_SAMESITE` mismatch |
| `permission denied for table` | Owner role differs from the dump's grants — re-run `grants.sql` |
| Healthcheck fails at boot | `DATABASE_URL` not linked to the Postgres plugin |
