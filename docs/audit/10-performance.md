# 10 — Performance Audit

## What's in place

| Optimization | Status | Notes |
|---|---|---|
| Route-based code splitting | ✅ | All 17 routes use `React.lazy()` in `src/App.tsx` |
| `<Suspense>` boundary | ✅ | Single top-level `RouteSkeleton` fallback |
| `ErrorBoundary` | ✅ | Top-level, hooked into monitoring |
| React Query caching | ✅ | `staleTime: 60s`, `gcTime: 5m`, `refetchOnWindowFocus: false`, `retry: 1` |
| Vite + SWC | ✅ | `@vitejs/plugin-react-swc` |
| Tailwind purge | ✅ (Tailwind v3 JIT) | Default Vite config |
| Font preconnect | ✅ | `fonts.googleapis.com` / `gstatic.com` in `index.html` |
| `loading="lazy"` on `<img>` | **Needs verification** | Audit individual components |
| Skeleton states | Partial | `RouteSkeleton` only; pages use ad-hoc loading flags |

## What's missing

| Gap | Impact |
|---|---|
| **No bundle analysis** in CI — bundle size is unknown. With `recharts`, `embla-carousel`, `html2canvas`, `react-markdown`, `cmdk`, and the full Radix + shadcn set, the initial chunk is likely heavy. | High (LCP / TTI) |
| **No skeleton per page** — direct-Supabase pages show empty UI while loading. | Med |
| **No image optimization** — uploaded images served raw from Storage. | High (LCP) |
| **No SSR / pre-rendering** — every public page is CSR, hurting LCP and SEO. | Med |
| **`react-helmet-async`** mounts late (after JS hydration). Meta tags arrive after first paint. | Med (SEO/social previews) |
| **`html2canvas`** imported eagerly by milestone unlock — should be dynamic-imported only when share-card is generated. | Med |
| **Recharts** loaded on Leaderboard but possibly via shared chunk. | Verify |

## Slow queries (`pg_stat_statements`)

All measured queries are sub-millisecond on near-empty data. The dataset is too small to draw conclusions.

| Query (normalized) | Calls | Mean ms | Notes |
|---|---:|---:|---|
| `SELECT role FROM user_roles WHERE user_id = $1` | 46 | 0.20 | Called every auth event — fine, indexed |
| `SELECT activity_logs WHERE user_id = $1 ORDER BY activity_date DESC` | 11 | 0.27 | Indexed via `idx_activity_user` ✓ |
| `SELECT full_name FROM profiles WHERE id = $1` | 11 | 0.20 | Indexed (PK) ✓ |
| `SELECT id FROM user_milestones WHERE user_id = $1` | 11 | 0.03 | Fine |

No N+1 found from `pg_stat_statements`. Re-audit after first ~1000 users.

## Re-render risks (frontend)

| Component | Risk | Recommendation |
|---|---|---|
| `Dashboard.tsx` | 10+ `useState`, multiple effects, fetches on every mount, no memoization | Migrate to React Query; split into smaller components |
| `Navbar.tsx` | Reads `useAuth` (changes on every role refresh) | Memoize role-dependent nav items |
| `Index.tsx` (`HallOfFameSection`) | Direct RPC on every mount | Move to RQ with 5-min staleTime |

## Recommendations (perf, in priority order)

1. Add `rollup-plugin-visualizer` in `vite.config.ts`, run on a per-PR basis. Target initial JS ≤ 200 KB gzipped.
2. Move `html2canvas` to `await import("html2canvas")` inside the share handler.
3. Pre-warm route chunks (`<link rel="modulepreload">`) for `/challenges` from `/` via Vite manifest hooks.
4. Add Supabase Storage transform parameters to all `<img>` `src` (e.g. `?width=800&quality=70&format=webp`).
5. Convert direct-Supabase pages to React Query — eliminates duplicate fetches and unmount-remount refetches.
6. Add per-page skeleton components.
7. (Stretch) Switch to a pre-render solution (`vite-plugin-ssr`, `react-snap`, or Cloudflare Pages prerender) for `/`, `/challenges`, `/blog`, `/challenges/:slug` to improve LCP + social previews.
