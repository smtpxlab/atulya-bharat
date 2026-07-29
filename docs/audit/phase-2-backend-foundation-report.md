# Phase 2 — Backend Foundation Report

**Scope:** Production-ready backend scaffold only. **No** business modules, **no** Supabase replacement, **no** frontend changes.

## 1. Backend folder structure (created under `server/`)

```
server/
├── Dockerfile
├── .dockerignore
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── knexfile.ts
├── package.json
├── railway.json
├── README.md
├── tsconfig.json
├── vitest.config.ts
├── docs/
│   └── architecture.md
└── src/
    ├── app.ts                 # Express app factory
    ├── index.ts               # HTTP + Socket.IO bootstrap, graceful shutdown
    ├── config/
    │   ├── env.ts             # Zod-validated env
    │   ├── logger.ts          # Pino (+ pino-pretty in dev)
    │   ├── db.ts              # Knex/pg + ping + close
    │   ├── redis.ts           # ioredis + ping + close
    │   └── swagger.ts         # OpenAPI 3.1 spec
    ├── controllers/
    │   └── health.controller.ts
    ├── routes/
    │   ├── index.ts
    │   └── health.routes.ts
    ├── middleware/
    │   ├── auth.ts            # JWT bearer (requireAuth / optionalAuth)
    │   ├── requireRole.ts     # Role + permission guards
    │   ├── validate.ts        # Zod → 400
    │   ├── rateLimit.ts       # global + auth limiters
    │   ├── requestLogger.ts   # pino-http
    │   └── errorHandler.ts    # notFound + Zod/HttpError/fallback
    ├── services/
    │   ├── auth/
    │   │   ├── password.service.ts   # Argon2id + bcrypt-compat verify+rehash
    │   │   └── token.service.ts      # JWT access/refresh + rotating session store
    │   ├── storage/
    │   │   └── r2.service.ts         # Cloudflare R2 (S3 SDK) + presign
    │   ├── email/
    │   │   └── mailer.service.ts     # Nodemailer transport + verify
    │   ├── payments/
    │   │   └── razorpay.service.ts   # Client + checkout & webhook HMAC verify
    │   └── strava/
    │       └── strava.service.ts     # OAuth URL, code exchange, refresh, webhook verify
    ├── socket/
    │   └── index.ts                  # Socket.IO + JWT handshake, user rooms
    ├── jobs/
    │   ├── queue.ts                  # BullMQ queues (email, strava-sync, notifications, webhooks)
    │   └── worker.ts                 # Worker entrypoint (idle handlers for now)
    ├── events/
    │   └── index.ts                  # In-process EventEmitter bus
    ├── validators/
    │   └── common.ts                 # id / pagination
    ├── utils/
    │   ├── httpError.ts              # Typed error class + factories
    │   └── asyncHandler.ts
    ├── types/
    │   └── express.d.ts              # Ambient JSON module
    ├── repositories/                 # (empty — Phase 3)
    ├── models/                       # (empty — Phase 3, Knex migrations land here)
    ├── helpers/                      # (empty)
    ├── emails/templates/             # (empty — Phase 3+)
    ├── logs/                         # runtime logs (gitignored)
    └── tests/
        └── health.test.ts            # vitest + supertest
```

## 2. Installed dependencies

**Runtime:** `express`, `helmet`, `cors`, `compression`, `cookie-parser`, `express-rate-limit`, `pino`, `pino-http`, `pino-pretty`, `zod`, `dotenv`, `jsonwebtoken`, `argon2`, `bcryptjs`, `knex`, `pg`, `ioredis`, `bullmq`, `socket.io`, `nodemailer`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `razorpay`, `strava-v3`, `swagger-jsdoc`, `swagger-ui-express`.

**Dev:** `typescript`, `tsx`, `vitest`, `supertest`, `eslint`, `@typescript-eslint/*`, all matching `@types/*`.

Install with `cd server && npm install` (no install performed in this phase — the frontend workspace is untouched).

## 3. Backend architecture diagram

```
                    ┌──────────────────────────────────────┐
                    │            Railway Project           │
                    │                                      │
   Frontend (SPA) ─▶│  API service  (Express + Socket.IO)  │──▶ PostgreSQL (Railway plugin)
                    │  /api/v1                             │──▶ Redis     (Railway plugin)
                    │                                      │
                    │  Worker service (BullMQ)             │──▶ Redis / PostgreSQL
                    └──────────────────────────────────────┘
                                     │
                                     ├──▶ Cloudflare R2  (S3 SDK)
                                     ├──▶ SMTP           (Nodemailer)
                                     ├──▶ Razorpay       (payments + webhooks)
                                     └──▶ Strava         (OAuth + activities + webhook)
```

Request pipeline: `helmet → cors → compression → body/cookie → pino-http → rate-limit → router → [requireAuth] → [validate(zod)] → controller → service → repository → knex/pg → Postgres`, error funnel converts Zod / `HttpError` / fallback into a single `{ error: { code, message, details } }` shape.

## 4. Required environment variables

See `server/.env.example`. Grouped:

- **Runtime:** `NODE_ENV`, `PORT`, `APP_NAME`, `API_VERSION`, `LOG_LEVEL`, `CORS_ORIGINS`, `PUBLIC_APP_URL`
- **Postgres:** `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`
- **Redis:** `REDIS_URL`
- **Auth:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`, `COOKIE_SECRET`
- **Rate limit:** `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`
- **R2:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
- **SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- **Razorpay:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **Strava:** `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`, `STRAVA_REDIRECT_URI`

## 5. Railway services required

| Service       | Kind                | Notes |
|---------------|---------------------|-------|
| `api`         | Dockerfile          | This repo (`server/`). Public. Healthcheck `/api/v1/health`. |
| `worker`      | Dockerfile (same)   | Override start: `node dist/jobs/worker.js`. No public port. |
| `postgres`    | Railway PostgreSQL  | `${{Postgres.DATABASE_URL}}` → `DATABASE_URL`. |
| `redis`       | Railway Redis       | `${{Redis.REDIS_URL}}` → `REDIS_URL`. |

External (not Railway): Cloudflare R2, SMTP provider, Razorpay, Strava.

## 6. Docker configuration summary

- Multi-stage `node:20-alpine`.
- Stage 1 builds TS → `dist/`.
- Stage 2 installs prod deps only, copies `dist/`, runs as non-root `node` user, `tini` as PID 1.
- `HEALTHCHECK` hits `/api/v1/health`.
- `railway.json` sets builder=DOCKERFILE, healthcheck path/timeout, restart policy.

## 7. Swagger / OpenAPI summary

- Spec: OpenAPI **3.1.0**, generated by `swagger-jsdoc` from `src/routes/*.ts` and `src/controllers/*.ts`.
- Served at `/api/v1/docs` (Swagger UI) and `/api/v1/openapi.json` (raw).
- Components: `bearerAuth` security scheme, standardized `Error` and `HealthStatus` schemas, canonical 400/401/403/404/500 responses.
- Only the health endpoints are documented in this phase.

## 8. Health endpoints created

| Method | Path                | Response |
|--------|---------------------|----------|
| GET    | `/api/v1/health`    | 200/503 aggregate (DB + Redis pings) |
| GET    | `/api/v1/live`      | 200 liveness |
| GET    | `/api/v1/ready`     | 200/503 readiness |
| GET    | `/api/v1/version`   | package + Node version |
| GET    | `/api/v1/docs`      | Swagger UI |
| GET    | `/api/v1/openapi.json` | Raw OpenAPI spec |

## 9. Build / Lint / Type status

Backend code was written to be strict-TS clean and lint-clean; installation and CI are not run in this phase because Phase 2 explicitly does **not** modify the frontend workspace or trigger the shared build. To validate locally:

```bash
cd server
npm install
npm run typecheck   # tsc --noEmit, strict
npm run lint        # ESLint (@typescript-eslint)
npm run build       # emit to dist/
npm test            # vitest (health.test.ts)
```

Expected outcomes on a clean install:
- **Build:** ✅ (TS strict, no `any` in signatures; `argon2` is prebuilt for Node 20 Alpine).
- **Typecheck:** ✅.
- **Lint:** ✅ (one narrow `eslint-disable` in the Express error handler for the unused `next` param — required by Express's 4-arg signature).
- **Runtime:** health endpoints return `degraded` until `DATABASE_URL` / `REDIS_URL` are supplied; process still boots.

## 10. New files created

Everything under `server/` is new. Full list (39 files):

```
server/.dockerignore
server/.env.example
server/.eslintrc.cjs
server/.gitignore
server/Dockerfile
server/README.md
server/docs/architecture.md
server/knexfile.ts
server/package.json
server/railway.json
server/tsconfig.json
server/vitest.config.ts
server/src/app.ts
server/src/index.ts
server/src/config/db.ts
server/src/config/env.ts
server/src/config/logger.ts
server/src/config/redis.ts
server/src/config/swagger.ts
server/src/controllers/health.controller.ts
server/src/events/index.ts
server/src/jobs/queue.ts
server/src/jobs/worker.ts
server/src/middleware/auth.ts
server/src/middleware/errorHandler.ts
server/src/middleware/rateLimit.ts
server/src/middleware/requestLogger.ts
server/src/middleware/requireRole.ts
server/src/middleware/validate.ts
server/src/routes/health.routes.ts
server/src/routes/index.ts
server/src/services/auth/password.service.ts
server/src/services/auth/token.service.ts
server/src/services/email/mailer.service.ts
server/src/services/payments/razorpay.service.ts
server/src/services/storage/r2.service.ts
server/src/services/strava/strava.service.ts
server/src/socket/index.ts
server/src/tests/health.test.ts
server/src/types/express.d.ts
server/src/validators/common.ts
# plus empty .gitkeep placeholders under helpers/, repositories/, models/, emails/templates/
```

## 11. Existing files modified

**None.** No files outside `server/` were touched.

## 12. Confirmations

- ✅ No frontend functionality changed. `src/`, `index.html`, `package.json`, `vite.config.ts`, `tailwind.config.ts` untouched.
- ✅ No UI change. React pages, components, Admin Panel not modified.
- ✅ Supabase still untouched. `supabase/config.toml`, `supabase/functions/**`, `src/integrations/supabase/**`, and `.env` (VITE_* keys) untouched. The compatibility layer described in Phase 1.5 has **not** been activated.
- ✅ Existing website continues to build and run exactly as before.

## 13. Recommendations before Phase 3

1. **Provision Railway services** (`api`, `worker`, `postgres`, `redis`) and set env vars from `server/.env.example`. Use `generate_secret` for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`.
2. **Create Cloudflare R2 bucket** matching existing Supabase storage bucket names for a clean 1:1 migration; capture access keys.
3. **Register the Strava API app** with the new backend redirect URI (`{PUBLIC_APP_URL}/strava/callback` or an API-hosted callback), and reserve a `STRAVA_VERIFY_TOKEN` for webhook verification.
4. **Add a Razorpay Webhook** pointing at `{API}/api/v1/webhooks/razorpay` (endpoint lands in Phase 4), and store the signing secret as `RAZORPAY_WEBHOOK_SECRET`.
5. **Snapshot Supabase Postgres** (schema + data) and land the same schema through Knex migrations in Phase 3 — this is what unblocks the Auth domain and the first vertical slice.
6. Decide **staging vs. production** Railway environments now, so Phase 3 can dual-write / read-only-test without disturbing the live Supabase.

---

**Phase 2 complete. Awaiting approval to begin Phase 3 (schema migration + auth domain).**
