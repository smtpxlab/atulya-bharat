# Atulya Bharat Run — Backend (Phase 2 Foundation)

Independent Node.js/Express service that will progressively replace the
Supabase/Lovable Cloud backend. **Phase 2 delivers infrastructure only** —
no business endpoints, no Supabase replacement, no frontend changes.

## Quick start

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

- API: <http://localhost:8000/api/v1>
- Health: <http://localhost:8000/api/v1/health>
- Swagger UI: <http://localhost:8000/api/v1/docs>
- OpenAPI: <http://localhost:8000/api/v1/openapi.json>

## Scripts

| Script            | Purpose                                       |
|-------------------|-----------------------------------------------|
| `npm run dev`     | tsx watch (hot reload)                        |
| `npm run build`   | TypeScript → `dist/`                          |
| `npm start`       | Production start (`node dist/index.js`)       |
| `npm run worker`  | BullMQ worker entry (`tsx src/jobs/worker.ts`)|
| `npm run typecheck` | Type-only build (no emit)                   |
| `npm test`        | Vitest + supertest                            |

## Environment

See [.env.example](./.env.example). Zod-validated at boot; missing critical
values (DB, Redis) do not crash — health endpoints report them as `degraded`.

## Deploy to Railway

- Dockerfile: multi-stage, `node:20-alpine`, non-root user, tini as PID 1.
- Healthcheck: `/api/v1/health` (see `railway.json`).
- Suggested Railway services:
  1. **api** — this repo, Dockerfile, exposes `$PORT`.
  2. **worker** — same image, `startCommand = node dist/jobs/worker.js`
     (or `npm run worker` in dev).
  3. **postgres** — Railway PostgreSQL plugin.
  4. **redis** — Railway Redis plugin.
- Attach `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` as variables.

## Architecture

See [`docs/architecture.md`](./docs/architecture.md).

## Migration status

- ✅ Phase 2 — Backend foundation (this).
- ⏳ Phase 3 — Schema migration + auth domain.
- ⏳ Phase 4 — Business modules (challenges, clubs, activities…).
- ⏳ Phase 5 — Supabase compatibility shim + frontend cutover.
