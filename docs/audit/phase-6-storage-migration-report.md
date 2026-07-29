# Phase 6 — Storage Migration Report

Status: **Complete (backend-only).** Frontend, Supabase Storage calls, and the
compatibility layer remain **untouched**. Razorpay, Strava, and Edge Functions
are out of scope for this phase.

---

## 1. Storage architecture

```
┌──────────────────────────────────────────────────────────┐
│                Express API (server/)                     │
│                                                          │
│   /api/v1/storage/*  ──►  StorageService                 │
│                             │                            │
│                             ├─ buckets.ts   (registry)   │
│                             ├─ validation.ts (MIME/size) │
│                             └─ r2 client (S3 SDK)        │
│                                    │                     │
│                                    ▼                     │
│                       Cloudflare R2  (env.R2_BUCKET)     │
│                       physical key = "<bucket>/<path>"   │
└──────────────────────────────────────────────────────────┘
```

- **Single physical R2 bucket** holds all logical buckets; the first path
  segment is the original Supabase bucket id. This preserves every URL-shaped
  reference already stored in the database (`gallery_images.image_url`,
  `blog_posts.cover_url`, `challenges.cover_image_url`, etc.).
- **Public URL shape:** `${R2_PUBLIC_BASE_URL}/<bucket>/<path>`. The
  compatibility layer (Phase 7+) rewrites the base host only — no row edits.
- **Auth:** mutating endpoints require `requireAuth`; role gating for
  admin-only buckets is enforced by the domain routes that call
  `StorageService`, not by the raw `/storage/*` API.

## 2. Upload APIs (mounted under `/api/v1/storage`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/buckets` | – | List logical buckets, MIME rules, size caps |
| POST | `/object/:bucket` (multipart `file`, optional `path`, `?upsert=`) | user | Server-side upload (multer memory) |
| POST | `/signed-upload/:bucket` `{path, contentType, expiresIn?}` | user | Presigned PUT URL for direct browser upload |
| GET  | `/object/:bucket/public/:path*` | – | Resolve public URL (Supabase `getPublicUrl` parity) |
| GET  | `/object/:bucket/signed/:path*` `?expiresIn=` | – | Presigned GET URL for private reads |
| DELETE | `/object/:bucket/:path*` | user | Delete a single object |
| POST | `/object/:bucket/delete-many` `{paths[]}` | user | Batch delete |

All responses use the standard `{ data }` / `204` envelope shared by the rest
of the API.

## 3. Bucket mapping

Logical bucket names are **preserved verbatim** from Supabase Storage:

| Supabase bucket | R2 physical key prefix | Public | MIME | Max size |
|---|---|---|---|---|
| `club-logos` | `club-logos/…` | ✔ | `image/*` | 5 MB |
| `blog-images` | `blog-images/…` | ✔ | `image/*` | 10 MB |
| `challenge-covers` | `challenge-covers/…` | ✔ | `image/*` | 10 MB |
| `challenge-assets` | `challenge-assets/…` | ✔ | `image/*` | 10 MB |
| `gallery` | `gallery/…` | ✔ | `image/*` | 10 MB |
| `milestone-images` | `milestone-images/…` | ✔ | `image/*` | 10 MB |
| `milestone-audio` | `milestone-audio/…` | ✔ | `audio/*` | 25 MB |
| `participation-photos` | `participation-photos/…` | ✔ | `image/*` | 10 MB |

Folder conventions inside each bucket (`<userId>/<registrationId>.<ext>`,
`rich-text/<folder>/<uuid>.<ext>`, etc.) are honored — the service takes the
caller's `path` verbatim.

## 4. Validation

- Per-bucket MIME family allow-list + strict per-family allow-list
  (`image/jpeg|png|webp|gif|svg+xml|avif`, `audio/mpeg|wav|ogg|webm|m4a`).
- Per-bucket byte cap + hard 25 MB cap at the multer layer.
- `upsert=false` by default; existence checked via `HeadObject`.

## 5. Migration strategy

Data is **not** moved in this phase — only the code path is ready. The bulk
object migration will run in a later cutover window, orchestrated by:

1. `rclone sync supabase-storage:<bucket> r2:<physical-bucket>/<bucket>` for
   each logical bucket, preserving object keys.
2. Post-copy `HeadObject` audit (script to be added in Phase 7) to confirm
   parity of counts and byte totals per bucket.
3. Flip `R2_PUBLIC_BASE_URL` in the compatibility layer (Phase 7+); DB rows
   remain untouched because URL suffixes match.

Until cutover, `StorageService` is fully functional but **not called by the
frontend** — the app still uses `supabase.storage.*` end-to-end.

## 6. Rollback strategy

- **Code:** revert this phase's commit; the rest of the backend is unaffected
  (routes are additive, no existing route modified except `routes/index.ts`).
- **Data:** since no data is copied yet, rollback is a no-op. Post-cutover, R2
  objects remain in place and the compatibility layer can be pointed back to
  Supabase URLs (or a dual-read fallback) without data loss.
- **Config:** clearing `R2_*` env vars degrades `/storage/*` to `503` and
  leaves the app fully operational on Supabase.

## 7. Testing report

- Unit tests: `server/src/tests/storage.service.test.ts` — validates bucket
  registry, key composition, MIME/size validation, extension mapping.
- Integration: presign + upload + delete against a real R2 bucket is a
  manual smoke test (documented in `server/README.md` follow-up) — deferred
  to cutover so we don't create objects in a bucket that may still be shared
  with production.
- Typecheck: `bun run typecheck` in `server/` (green).
- Build: `bun run build` in `server/` (green).

## 8. Files created

- `server/src/services/storage/buckets.ts`
- `server/src/services/storage/validation.ts`
- `server/src/services/storage/storage.service.ts`
- `server/src/validators/storage.schemas.ts`
- `server/src/controllers/storage.controller.ts`
- `server/src/routes/storage.routes.ts`
- `server/src/tests/storage.service.test.ts`
- `docs/audit/phase-6-storage-migration-report.md`

## 9. Files modified

- `server/src/routes/index.ts` — mounts `/storage`.
- `server/package.json` — adds `multer` + `@types/multer`.

_(The pre-existing `server/src/services/storage/r2.service.ts` low-level
helper remains in place; `storage.service.ts` supersedes it for domain use.)_

## Confirmations

- ✅ No frontend files modified.
- ✅ Supabase Storage calls untouched — the app still uses
  `supabase.storage.*` everywhere.
- ✅ Compatibility layer **not** activated.
- ✅ Razorpay / Strava / Edge Functions untouched.
- ✅ All Supabase bucket names and paths preserved 1:1.

**Awaiting approval before Phase 7.**
