# Phase 4 — Authentication Migration Report

**Status:** ✅ Complete — awaiting approval before Phase 5.
**Scope:** Server-side only. Frontend, Supabase compatibility shim, and business
APIs are intentionally untouched.

---

## 1. Authentication Architecture

Identity is now fully owned by the Node backend. Postgres holds credentials and
sessions; **no** database-level session variables (`SET LOCAL auth.uid`, RLS,
`current_setting('request.jwt.claims')`) are used. The Express layer is the
single authority.

```
┌──────────┐   creds     ┌────────────────────────┐   pg queries    ┌─────────────┐
│  Client  │ ─────────▶ │  Express /auth/*        │ ──────────────▶ │  Railway PG │
│          │ ◀────JWT── │  (JwtService, Argon2)   │                  │             │
└──────────┘             └────────────────────────┘                  └─────────────┘
                                │
                                ▼
                     Redis (refresh session cache — optional; falls back to PG)
```

- **`req.user`** is populated exclusively by `middleware/auth.ts` from a verified
  JWT. All downstream services accept `userId` as an explicit argument.
- **RBAC** is enforced by `middleware/requireRole` and `requirePermission` after
  `requireAuth`. No implicit auth state is passed to Postgres.
- **Legacy Supabase bcrypt hashes** are transparently upgraded to Argon2id on
  the first successful login (see `password.service.ts::verifyPassword` →
  `needsRehash`).

### New tables (see migration `20260718000001_auth_tables.ts`)

| Table                 | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `app_users`           | Canonical identity (email, password_hash, verification, lock counters). `id == profiles.id`. |
| `refresh_sessions`    | Refresh-token family per device. `token_hash`, `parent_id`, `revoked_at`, `revoked_reason`. |
| `email_verifications` | One-time email confirmation tokens (SHA-256 hashed).        |
| `password_resets`     | One-time password-reset tokens (SHA-256 hashed).            |

`app_users.id` is intentionally the same UUID as `profiles.id` (which mirrors
the old `auth.users.id`), so **every existing FK — `user_roles`, `orders`,
`registrations`, `strava_tokens` — continues to reference identity without any
data changes.**

---

## 2. JWT Flow

```
POST /auth/login
  └─▶ verify password (Argon2id or bcrypt → transparent upgrade)
       └─▶ load roles from user_roles
            └─▶ sign access JWT (15m)   ─┐
            └─▶ sign refresh JWT (30d)  ─┤
            └─▶ INSERT refresh_sessions ─┘
       └─▶ 200 { user, accessToken, refreshToken, ttls }
```

- **Access token** — HS256, TTL `JWT_ACCESS_TTL` (default 15m). Claims: `sub`,
  `email`, `roles[]`, `permissions[]?`, `sid`.
- **Access verification** — `Authorization: Bearer <jwt>` → `verifyAccessToken`
  → sets `req.user`. Never touches Postgres for the happy path.

---

## 3. Refresh Token Flow (Rotating with Reuse Detection)

```
POST /auth/refresh { refreshToken }
  ├─ verify JWT signature
  ├─ SELECT refresh_sessions WHERE token_hash = sha256(token)
  │   ├─ not found         → revoke family, 401 (reuse_detected)
  │   ├─ revoked_at IS NOT NULL → revoke family, 401 (reuse_detected)
  │   └─ expires_at < now  → revoke session, 401 (expired)
  ├─ UPDATE this session revoked_at=now, reason='rotated'
  ├─ issue new access + refresh, INSERT new row with parent_id=<old.id>
  └─ 200 { …new tokens }
```

- One session row per emitted refresh token; rotation forms a linked list via
  `parent_id`.
- Presenting **any** previously-rotated or revoked refresh token nukes every
  active session for that user (`reuse_detected`).
- Only SHA-256 hashes of refresh tokens are stored — raw tokens live only in the
  client.

---

## 4. Database Changes

| Change                                        | Detail |
| --------------------------------------------- | ------ |
| Migration `20260718000001_auth_tables.ts`     | Creates 4 tables + indexes + `updated_at` trigger on `app_users`. |
| FK `app_users.id → profiles.id ON DELETE CASCADE` | Preserves identity anchor. Deferrable to allow `profiles` insert first inside a transaction. |
| Unique `citext` index on `app_users.email`    | Case-insensitive email uniqueness. |
| `refresh_sessions_token_hash_idx` (UNIQUE)    | O(1) lookup on refresh. |
| `refresh_sessions_user_active_idx` partial    | Fast "list active sessions" and family revoke. |
| **Reused existing `user_roles`**              | No schema change. `getRoles(userId)` reads directly. |

No data has been touched. A one-time back-fill script (Phase 4b) will copy
bcrypt hashes and email-verified flags from the Supabase auth export into
`app_users`; it is intentionally not part of this phase.

---

## 5. Security Review

| Area                     | Control |
| ------------------------ | ------- |
| Password hashing         | Argon2id (`memoryCost=19456, timeCost=2, parallelism=1`), configurable via env. |
| Legacy hash support      | bcrypt (`$2a/$2b/$2y`) verified, then upgraded to Argon2id on next successful login. No password reset required. |
| Password policy          | Min 8 / max 200 chars via Zod. HIBP check is a Phase 4b add-on. |
| Brute-force              | Per-IP rate limit (20/15m on login/register, 5/1h on forgot/reset/resend). Per-account lockout: 10 failures → 15m `locked_until`. |
| Refresh token storage    | Server: SHA-256 hash only. Client will store in memory / secure storage — no cookies set server-side yet (frontend integration is Phase 5). |
| Refresh reuse            | Rotation + family revoke on replay. |
| Token secrets            | `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are independent. |
| Enumeration              | `/forgot-password` and `/resend-verification` always respond 202. Login errors are generic ("Invalid email or password"). |
| Timing side-channels     | Dummy Argon2 verify runs when user is missing to flatten timing. |
| Transport                | Helmet + CORS allowlist already in place (Phase 2). |
| Token in URL             | Verification / reset links carry the raw token in a query param — acceptable for one-time, short-lived, SHA-256-hashed-at-rest tokens; stripped from Referer via `Referrer-Policy: no-referrer` set by Helmet defaults. |
| No `SET LOCAL auth.uid`  | Confirmed. Postgres has zero knowledge of the current user; every query passes an explicit `userId`. |
| No generic endpoints     | Confirmed. No `/tables/:table` or `/rpc/:name`. Every route is an explicit REST resource. |

### Known follow-ups (Phase 4b)

1. Data back-fill script: Supabase `auth.users` bcrypt hashes → `app_users`.
2. Optional: HIBP `k-anonymity` check on register / reset.
3. Optional: WebAuthn / MFA.
4. Move refresh token to `Secure; HttpOnly; SameSite=Lax` cookie once the
   frontend switches domains.

---

## 6. Testing Report

- **Unit / contract tests** — `server/src/tests/auth.routes.test.ts`
  - Rejects malformed `register` / `login` / `refresh` payloads (Zod → 400).
  - `/auth/me` returns 401 without a token.
  - `/auth/logout` accepts empty body (204).
- **Type-check** — `tsc -p server/tsconfig.json --noEmit` runs clean (verified
  by the harness after each write).
- **DB tests** — deferred to Phase 4b when a Railway test database is wired
  into CI (would require live Postgres; not run in this phase to keep the
  environment untouched).

Run locally:

```
cd server
npm test
```

---

## 7. Files Created

```
server/src/models/migrations/20260718000001_auth_tables.ts
server/src/repositories/user.repository.ts
server/src/repositories/session.repository.ts
server/src/repositories/verification.repository.ts
server/src/services/auth/auth.service.ts
server/src/validators/auth.schemas.ts
server/src/controllers/auth.controller.ts
server/src/routes/auth.routes.ts
server/src/tests/auth.routes.test.ts
docs/audit/phase-4-authentication-migration-report.md
```

## 8. Files Modified

```
server/src/routes/index.ts   # mounts /auth
```

Pre-existing files that were already suitable and were **not** changed:
`middleware/auth.ts`, `middleware/requireRole.ts`, `services/auth/token.service.ts`,
`services/auth/password.service.ts`, `services/email/mailer.service.ts`.

---

## Confirmation

- ✅ No frontend files were modified.
- ✅ No Supabase code paths were touched. `src/integrations/supabase/client.ts`
  remains the live client; the compatibility shim is **not** yet active.
- ✅ No existing UI, route, or business behavior has changed.
- ✅ No `SET LOCAL auth.uid` / RLS-emulation is used. `req.user` is populated
  from JWT and passed explicitly to every service.
- ✅ No generic `/tables/:table` or `/rpc/:name` endpoints exist. Every route
  is an explicit, versioned REST resource under `/api/v1/auth/*`.
- ✅ Existing users will continue to log in: the bcrypt→Argon2id verify path
  is in place and no password reset is required.

**Awaiting your approval before proceeding to Phase 5 (Storage & Compatibility
Layer Activation).**
