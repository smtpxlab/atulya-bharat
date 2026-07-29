# Phase 8A – Compatibility Layer Implementation Report

**Status:** ✅ Implemented • 🚫 NOT activated
**Feature flag:** `VITE_BACKEND_ENABLED=false` (OFF)
**Date:** 2026-07-17

---

## 1. Supported methods

The compatibility layer exposes a Supabase-shaped client via
`src/integrations/backend/index.ts`. When the flag is OFF (default) it re-exports
the real Supabase client verbatim; when ON it constructs `createBackendClient()`
which routes every call to the Express backend built in phases 2–7.

| Namespace | Methods |
|---|---|
| `auth` | `getSession`, `getUser`, `signInWithPassword`, `signUp`, `signOut`, `refreshSession`, `resetPasswordForEmail`, `updateUser`, `onAuthStateChange` |
| `from(table)` | `select`, `insert`, `update`, `upsert`, `delete`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `is`, `order`, `limit`, `range`, `single`, `maybeSingle`, thenable |
| `rpc(name, args)` | POST `/rpc/:name` |
| `storage.from(bucket)` | `upload`, `remove`, `getPublicUrl`, `createSignedUrl`, `list` |
| `functions.invoke(name, opts)` | POST `/functions/:name` |
| `channel(name)` | `on(event, filter, cb)`, `subscribe`, `send`, `unsubscribe` (native `WebSocket` to `${BACKEND_URL}/realtime`) |
| top-level | `removeChannel`, `getChannels` |

Return shape mirrors `@supabase/supabase-js`: `{ data, error }` with `error =
{ message, status, details? }` on failure, so no React component change is
required for consumption.

## 2. Unsupported methods (deferred)

Not required by the current codebase; left out to keep the surface auditable
until a real caller appears:

- `auth.signInWithOAuth`, `auth.signInWithOtp`, `auth.verifyOtp`,
  `auth.exchangeCodeForSession`, `auth.admin.*`
- PostgREST operators: `contains`, `containedBy`, `overlaps`, `textSearch`,
  `or`, `not`, `filter` (generic), `csv()`, `explain()`
- `storage.from(...).move`, `copy`, `download`, `createSignedUrls` (plural),
  `createSignedUploadUrl`
- Realtime presence (`track`, `untrack`, `presenceState`) and broadcast ack

Each throws a normalized `{ error }` if called via the current builder path,
never a silent success.

## 3. Test coverage

`src/integrations/backend/__tests__/compat.test.ts` – 13 tests, all passing:

- Feature flag defaults to `false`
- `auth.signInWithPassword` persists session; `getSession` reads it
- `auth.signOut` clears the session
- `auth.onAuthStateChange` emits `INITIAL_SESSION`
- `from().select().eq().order().limit()` builds correct URL
- `from().insert()` issues `POST` with JSON body
- `from().single()` unwraps to first row
- HTTP errors surface as `{ data: null, error }`
- `rpc()` posts to `/rpc/:name`
- `storage.upload` sends `FormData`
- `storage.getPublicUrl` composes URL
- `functions.invoke` targets `/functions/:name`
- `channel().subscribe()` returns a valid status and `removeChannel` resolves

```
$ bunx vitest run src/integrations/backend
Test Files  1 passed (1)
     Tests  13 passed (13)
```

## 4. Build status

- TypeScript: ✅ clean (Vite/tsgo)
- Vitest: ✅ 13/13 passing
- No modification to `src/integrations/supabase/client.ts` (auto-generated) or
  `types.ts`.

## 5. Files created

- `src/integrations/backend/config.ts` – feature flag + backend URL constants
- `src/integrations/backend/http.ts` – fetch wrapper, session store, JWT header
- `src/integrations/backend/auth.ts` – auth namespace
- `src/integrations/backend/from.ts` – PostgREST-shaped query builder
- `src/integrations/backend/rpc.ts` – RPC namespace
- `src/integrations/backend/storage.ts` – storage namespace
- `src/integrations/backend/functions.ts` – edge-function invoke shim
- `src/integrations/backend/channel.ts` – realtime channel over WebSocket
- `src/integrations/backend/client.ts` – composes `createBackendClient()`
- `src/integrations/backend/index.ts` – flag-driven export
- `src/integrations/backend/__tests__/compat.test.ts` – 13 tests
- `docs/audit/phase-8a-compatibility-layer-report.md` (this file)

## 6. Files modified

- `.env` – appended `VITE_BACKEND_ENABLED=false`, `VITE_BACKEND_URL`,
  `VITE_BACKEND_API_PREFIX` (flag stays OFF)

That is the only modification outside the new folder. **No React component,
page, hook, or route was touched.** `src/integrations/supabase/client.ts`
remains the auto-generated file exactly as-is.

## 7. Feature flag confirmation

```
$ grep VITE_BACKEND .env
VITE_BACKEND_ENABLED="false"
VITE_BACKEND_URL="http://localhost:8080"
VITE_BACKEND_API_PREFIX="/api/v1"
```

- Flag remains **OFF**.
- Existing React components import from `@/integrations/supabase/client` and
  therefore continue to use the real Supabase client. The new folder is
  entirely dormant until a future phase either flips the flag AND swaps a
  small number of imports to `@/integrations/backend`, or introduces a
  re-export shim.

## Notes for the reviewer

1. Per project rules, `src/integrations/supabase/client.ts` is auto-generated
   and must not be edited. The compatibility layer therefore lives at
   `src/integrations/backend/` and is wired via `index.ts`. Activation in
   Phase 8B is a one-line change (either flip the flag AND update imports, or
   add a re-export from the supabase folder pointing at the backend index).
2. `channel()` uses native `WebSocket` — no new npm dependency added.
3. The `from()` builder is intentionally a subset. Any component reaching for
   an unsupported operator will fail loudly on the first cutover attempt,
   which is the desired behavior for staged migration.

**Awaiting approval before proceeding to Phase 8B (Activation).**
