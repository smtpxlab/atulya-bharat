# Mobile auth variant + Mobile App Specification (Railway build)

Three parts: (1) a code change adding a mobile-friendly token transport to the existing auth API, (2) redeploy of the Railway service from this build and live verification of the API, (3) the mobile app specification document describing the Railway custom Express API + Postgres as the single API contract.

## Verified current state

- `atulyabharatrun.xlab.website` serves the Lovable-hosted React bundle (`/api/v1/live` returns `index.html`), so Lovable Cloud is still the live production backend; Railway (`abrsite-production.up.railway.app`, `/api/v1/live` → `{"status":"alive"}`) runs in parallel.
- Railway's Postgres contains imported content data (`/api/v1/blogs` returns real rows), but the Railway deployment runs older server code: `/api/v1/challenges` returns 500 and `/api/v1/rpc/*` returns "Route not found".
- Custom-auth password hashes were never migrated; only the manually bootstrapped admin exists, so a forced reset for real users is still outstanding.

The specification will document the Railway custom API only. Anything that currently exists solely on Lovable Cloud is listed as a pre-launch migration item, not as an API surface.


## Part 1 — Mobile auth variant (code change)

Goal: a native client can authenticate without a cookie jar or CSRF cookie, while the web flow is byte-for-byte unchanged.

Behaviour when a request sends `X-Client-Type: mobile`:

- `POST /api/v1/auth/login` (and `/register`) — no `Set-Cookie` for the refresh token and no CSRF cookie; the JSON body carries `refreshToken` (plus `accessToken`, `user`, `sessionId`, expiry).
- `POST /api/v1/auth/refresh` — reads the refresh token from the JSON request body, returns the rotated `refreshToken` in the JSON body, sets no cookies.
- `POST /api/v1/auth/logout` — accepts the refresh token in the body (already supported) and skips cookie clearing.
- Requests without the header keep the existing HTTP-only cookie + CSRF double-submit behaviour exactly as today.

Files touched (server only):

- `server/src/controllers/auth.controller.ts` — the existing `respondWithSession` already special-cases `X-Client-Type: native`; generalise it to treat `mobile` and `native` as the same "token in body" mode, and skip `setRefreshCookie` / `issueCsrfToken` entirely in that mode. Apply the same skip to `clearRefreshCookie` in `logout`, `resetPassword`, `changePassword`, `revokeAllSessions`.
- `server/src/validators/auth.schemas.ts` — make `refreshToken` required when the mobile header is present (clear 400 instead of a confusing 401).
- `server/src/middleware/csrf.ts` — no change needed: it already exempts requests that carry no `abr_rt` cookie. Verify with a test rather than assuming.
- `server/src/utils/authCookies.ts` — `readRefreshToken` already falls back to `req.body.refreshToken`; add a small helper `isTokenTransportClient(req)` so header detection lives in one place.

Rotation and reuse detection: `authService.refresh` verifies the JWT, looks the session up by SHA-256 token hash, revokes the whole family on an unknown or already-revoked hash (`reuse_detected`, with an audit-log entry), then revokes the presented session as `rotated` and issues a new one. This logic is keyed on the token value and the `refresh_sessions` table, not on the transport, so it applies unchanged to the mobile variant. The plan adds tests that prove it: replaying a mobile refresh token twice must return 401 and revoke the family.

Tests (`server/src/tests/auth.routes.test.ts` and a new mobile-transport test): mobile login returns `refreshToken` in the body and sets no `abr_rt` cookie; web login still sets the cookie and omits the body token; mobile refresh with a body token rotates and returns a new token; replayed mobile token → 401; mobile mutations succeed without any CSRF header.

## Part 2 — Redeploy Railway and verify the live API

Before any endpoint is written into the spec it must be confirmed against the live Railway service:

1. You redeploy `abrsite-production.up.railway.app` from this build (picks up the challenges/tickets fixes, the `/rpc/*` routes, the generic `/tables` embed handling, and the Part 1 mobile auth transport).
2. I then probe each documented endpoint over HTTPS — public routes directly, authenticated routes with a mobile-transport login using an admin/test account you nominate — and record the real request/response shapes.
3. Anything still failing (e.g. `/api/v1/challenges` 500) is diagnosed and fixed in `server/` before it reaches the document. Endpoints that cannot be made to respond are marked explicitly as "not available on Railway yet" rather than documented from source alone.

## Part 3 — Specification document

One new document: `docs/mobile/MOBILE_APP_SPECIFICATION.md`, plus small companion diagrams under `docs/mobile/diagrams/` (auth flow, data flow, payment flow, Strava flow).




## Contents of the specification

1. **Product overview** — what Atulya Bharat Run is: virtual run/walk/ride challenges, milestone progress, clubs, leaderboard, blog, gallery, certificates/bibs.
2. **Deployed architecture** — single Railway service: Express serves the built React bundle and the API under `/api/v1`; Postgres on Railway; Cloudflare R2 for files; Razorpay for payments; Strava for activity sync; SMTP for email.
3. **Authentication contract** — custom auth (`/api/v1/auth/*`): register, login, logout, refresh, forgot/reset password, change password, `/me`, sessions/devices/login-history. Includes the **exact request and response shapes for both variants** of `/auth/login` and `/auth/refresh` (web cookie + CSRF vs mobile `X-Client-Type: mobile` with the refresh token in the body), rotation and reuse-detection semantics, token TTLs, secure-storage guidance, and error codes (401 invalid/reused token, 403 CSRF, 429 rate limit).
4. **Roles and access** — `user`, `admin`, `super_admin`, how `/user-roles/me` drives gating, and which screens are admin-only (recommendation: keep admin web-only for v1).
5. **Screen inventory** — every route in the published web app mapped to a proposed mobile screen, with data source per screen: home, challenges list/detail, checkout, my challenges, registration detail (progress map, milestones, certificate/bib), clubs list/detail/create, leaderboard, blog list/post, gallery, about/contact, legal pages, profile, security, notifications, auth screens.
6. **API reference** — every mounted route group with method, path, auth requirement, request and response shape: auth, profiles, user-roles, challenges, registrations, milestones, activities, orders, coupons, blogs, pages, gallery, faqs, testimonials, notifications, clubs, newsletter, contact, storage, payments, strava, plus the generic `/tables/:table` PostgREST-style endpoint and `/rpc/:fn` allowlist (documented as internal compatibility surface the mobile app should avoid in favour of the domain routes).
7. **Data model** — the 28 tables with key columns and relationships, and the domain types the mobile app should mirror (challenge, ticket, registration, milestone, club, order, profile, notification).
8. **Business rules** — registration/checkout flow, coupon and club discounts, shipping cost, target days, distance accumulation from Strava vs manual entry, milestone unlocking, certificate eligibility, club approval states.
9. **Integrations for mobile** — Razorpay mobile SDK vs the current web checkout flow, Strava OAuth redirect handling in a native app (deep link vs in-app browser), push notifications (not present today; what the backend would need).
10. **Media and file handling** — R2 public URLs, upload endpoints, image size/MIME limits, bib/certificate generation location. Notes that some imported rows still reference Lovable Cloud storage URLs and must be rehosted on R2 before cutover.
11. **Cutover status** — a short, factual section: Railway vs the currently-live custom domain, which tables hold real data on Railway, the outstanding forced password reset, and the DNS/env steps that make Railway production (`VITE_BACKEND_ENABLED=true`, domain repoint).
12. **Environment and config** — which base URL the app points to, required env values, CORS implications for a native client.
13. **Gaps and required backend work for mobile** — push notification infrastructure, Razorpay native SDK wiring, Strava deep-link callback, and any data still only reachable through the generic tables shim. (Token-transport for native is no longer a gap — Part 1 implements it.)

## Technical approach

Spec content is derived from the Railway server sources (`server/src/routes/*`, `server/src/services/*`, `server/src/models/sql/*`), the web app's routes and types (`src/App.tsx`, `src/services/*`, `src/types/*`), and then verified request-by-request against the redeployed live Railway API. The only code changes are the server-side auth-transport additions and tests in Part 1, plus any fixes Part 2's verification uncovers; web frontend behaviour is untouched.
