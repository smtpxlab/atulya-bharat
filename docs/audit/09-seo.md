# 09 — SEO Audit

## Global (`index.html`)

```html
<title>Atulya Bharat Run — Run India. Virtually.</title>
<meta name="description" content="Virtual fitness challenges across India. Run, walk, or cycle real distances and unlock cultural milestones from iconic Indian cities." />
<meta name="author" content="Atulya Bharat Run" />
<meta property="og:title" ... />
<meta property="og:description" ... />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```

Strengths: title under 60 chars with keywords; description under 160 chars; OG + Twitter card defaults present.

Gaps:
- No `<link rel="canonical">` in `index.html` (`<SEO/>` adds per-route, but routes without `<SEO/>` fall back to none).
- No `og:image` default — Twitter `summary_large_image` requires an image.
- No `<meta name="theme-color">`.
- No JSON-LD `Organization` schema.
- No `<meta name="viewport">` issue (present, correct).

## `<SEO/>` component (`src/components/SEO.tsx`)

Wraps `react-helmet-async`. Emits per-page: title, description, canonical (relative path), OG (title/type/url/description/image), Twitter (card/title/description/image).

## Per-route coverage

| Route | `<SEO/>` | H1 in page | Notes |
|---|---|---|---|
| `/` | ❌ | Yes (`Run India. Virtually.` or similar) | Falls back to `index.html` defaults |
| `/login`, `/signup` | ❌ | Yes | Acceptable (low SEO value) |
| `/challenges` | ❌ | Yes | **HIGH-VALUE — must have** |
| `/challenges/:slug` | ❌ | Yes | **HIGHEST-VALUE — must have, per challenge** |
| `/dashboard`, `/auth/strava/callback` | ❌ | Yes | Behind auth — `noindex` recommended |
| `/clubs`, `/clubs/:slug`, `/clubs/create` | ❌ | Yes | Public-facing pages need SEO |
| `/leaderboard` | ❌ | Yes | Medium value |
| `/blog` | ✅ | Yes | Good |
| `/blog/:slug` | ✅ | Yes | Good — verify `og:image` set from `cover_image_url` |
| `/gallery` | ✅ | Yes | Good |
| `/contact` | ✅ | Yes | Good |
| `/admin` | ✅ | n/a | `noindex` not set explicitly |
| `*` (`NotFound`) | ✅ | Yes | Good |

## Sitemap & robots

- `public/robots.txt` — permissive (`Allow: /` for all bots). **No `Sitemap:` directive.**
- `public/sitemap.xml` — **does not exist**.
- No generator script (`scripts/generate-sitemap.ts`) and no `predev`/`prebuild` hook in `package.json`.

## Structured data

- No JSON-LD anywhere.
- Recommended schemas: `Organization` (sitewide), `Event` per challenge (virtual event with `eventAttendanceMode: OnlineEventAttendanceMode`), `Article` per blog post, `BreadcrumbList` on detail pages.

## Open Graph / Twitter

`<SEO/>` includes OG image only when `image` prop is passed. Pages using `<SEO/>` today rarely pass it — verify `BlogPost` passes `cover_image_url`.

## Recommendations (priority order)

1. **Add `<SEO/>` to `/`, `/challenges`, `/challenges/:slug`, `/clubs`, `/clubs/:slug`, `/leaderboard`.** Include per-record `og:image`.
2. **Generate `sitemap.xml`** via a `scripts/generate-sitemap.ts` invoked from `predev`/`prebuild`. Include all static routes + every `is_active` challenge slug + `is_published` blog slug + every public club slug.
3. **Add `Sitemap: <BASE_URL>/sitemap.xml`** directive to `robots.txt` once a domain is published.
4. **Add JSON-LD `Organization`** in `index.html` and `Event`/`Article` in the relevant detail pages.
5. **Add default `og:image`** (hero/brand image) to `index.html`.
6. Set `<meta name="robots" content="noindex" />` on `/dashboard`, `/admin`, `/auth/strava/callback`, `/clubs/create`.
