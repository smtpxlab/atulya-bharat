# 08 — Storage Audit

6 buckets. All but `club-logos` are flagged "private" at the bucket level but exposed via public-read storage policies.

| Bucket | `public` flag | Public read policy | Write policy | Consumers |
|---|---|---|---|---|
| `club-logos` | **true** | `bucket_id='club-logos' AND (auth.role()='authenticated' OR name IS NOT NULL)` | Authenticated upload + owner update/delete | `CreateClub.tsx` |
| `blog-images` | false | `bucket_id='blog-images'` (anon) | `has_role(admin)` | `BlogPost.tsx`, `Blog.tsx` (URL fields on `blog_posts`) |
| `challenge-covers` | false | `bucket_id='challenge-covers'` (anon) | `has_role(admin)` | `ChallengeDetail`, `ChallengeCard` |
| `gallery` | false | `bucket_id='gallery'` (anon) | `has_role(admin)` | `Gallery.tsx` |
| `milestone-images` | false | `bucket_id='milestone-images'` (anon) | `has_role(admin)` | `MilestoneUnlockScreen`, `MilestoneLibraryDrawer` |
| `milestone-audio` | false | `bucket_id='milestone-audio'` (anon) | `has_role(admin)` | `MilestoneUnlockScreen` |

## Signed URL usage

`rg "createSignedUrl|getSignedUrl"` → **0 matches**. The app exclusively uses `getPublicUrl` (`CreateClub.tsx:61`) or stores absolute URLs in the DB and renders them directly.

This is fine while all assets are intentionally public, but means:

- No expiration on hot-link URLs.
- No content access analytics.
- Cannot gate premium / region-locked media in the future without a refactor.

## Risks & gaps

| # | Issue | Severity |
|---|---|---|
| St1 | Buckets marked "private" but readable by anon via policy — confusing and lint-flag-worthy. Either set `public=true` or remove the anon read policy. | Low |
| St2 | No image optimization pipeline. Raw uploads go to bucket; no resize/webp variants. LCP risk for cover images. | Med |
| St3 | No max-file-size limit on `club-logos` upload (depends on Supabase default). | Low |
| St4 | `Club logos read` policy expression `(auth.role() = 'authenticated' OR name IS NOT NULL)` always evaluates to true (`name` is the object key, always non-null). Effectively public read. Document and simplify. | Low |
| St5 | No lifecycle/cleanup policy for orphaned uploads (logos of deleted clubs, etc.). | Low |

## Recommendations

1. Align `public` flag with the actual read policy (set `blog-images`, `challenge-covers`, `gallery`, `milestone-images`, `milestone-audio` to `public=true`).
2. Add Supabase Storage transform (`?width=...&quality=70&format=webp`) at render time for cover images.
3. Add per-bucket size + MIME-type restrictions in the migration.
4. When premium content lands, introduce a `storage.service.ts` with `createSignedUrl(bucket, path, ttl)` and gate access via a server-side check.
