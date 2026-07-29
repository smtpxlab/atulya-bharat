# Backend Architecture — Phase 2 Foundation

## Deployment topology (Railway)

```
                        ┌──────────────────────────────┐
                        │  Railway Project             │
                        │                              │
  Frontend (Lovable) ──▶│  API service (Node/Express)  │───▶ PostgreSQL (Railway plugin)
                        │  /api/v1 + Socket.IO         │───▶ Redis (Railway plugin)
                        │                              │
                        │  Worker service (BullMQ)     │───▶ Redis / PostgreSQL
                        └──────────────────────────────┘
                                    │
                                    ├─▶ Cloudflare R2 (S3 SDK)   — storage
                                    ├─▶ SMTP provider (Nodemailer) — email
                                    ├─▶ Razorpay API             — payments
                                    └─▶ Strava API               — activity sync
```

## Request lifecycle

```
Client ──▶ helmet ──▶ cors ──▶ compression ──▶ body/cookie parsers ──▶
  pino-http ──▶ rate limit ──▶ router ──▶ [auth] ──▶ [validate(zod)] ──▶
  controller ──▶ service ──▶ repository ──▶ knex/pg ──▶ Postgres
                                          └─▶ external SDK
  response ◀── error handler (Zod / HttpError / fallback)
```

## Folders

- `config/` — env parsing, logger, DB, Redis, Swagger
- `middleware/` — auth, roles, rate limit, request logger, error, validate
- `routes/` — route registration (versioned under `/api/v1`)
- `controllers/` — HTTP handlers; thin. Only health in Phase 2.
- `services/` — domain services and third-party clients
  - `auth/` — token + password (Argon2id, bcrypt-compat verify-then-rehash)
  - `storage/` — Cloudflare R2 (S3-compatible)
  - `email/` — Nodemailer transport
  - `payments/` — Razorpay client + signature verification
  - `strava/` — OAuth + refresh + webhook verify
- `repositories/`, `models/` — data access + Knex migrations (Phase 3+)
- `validators/` — shared Zod schemas
- `jobs/` — BullMQ queues + worker entry point
- `events/` — in-process app event bus
- `socket/` — Socket.IO server + JWT handshake
- `emails/templates/` — email templates (Phase 3+)
- `utils/`, `helpers/` — HttpError, asyncHandler, misc
- `docs/`, `tests/`, `logs/`, `types/`

## Health endpoints

| Method | Path              | Purpose                                   |
|--------|-------------------|-------------------------------------------|
| GET    | `/api/v1/health`  | Aggregate: DB + Redis pings               |
| GET    | `/api/v1/live`    | Liveness (process up)                     |
| GET    | `/api/v1/ready`   | Readiness (dependencies reachable)        |
| GET    | `/api/v1/version` | Package version + Node runtime            |
| GET    | `/api/v1/docs`    | Swagger UI                                |
| GET    | `/api/v1/openapi.json` | Raw OpenAPI 3.1 spec                 |

Railway `healthcheckPath` is set to `/api/v1/health`.
