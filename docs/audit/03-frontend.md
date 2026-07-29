# 03 — Frontend Audit

## Routes (`src/App.tsx`)

| URL | Component | Lazy | Guard | SEO `<SEO/>` | Data source |
|---|---|---|---|---|---|
| `/` | `Index` | Y | — | No (relies on `index.html` defaults) | Static + `HallOfFameSection` (direct RPC) |
| `/login` | `Login` | Y | — | No | `supabase.auth` |
| `/signup` | `Signup` | Y | — | No | `supabase.auth` |
| `/challenges` | `Challenges` | Y | — | No | `useChallenges` hook ✓ |
| `/challenges/:slug` | `ChallengeDetail` | Y | — | No | `useChallengeDetail` hook ✓ |
| `/dashboard` | `Dashboard` | Y | `ProtectedRoute` | No | Direct Supabase (10+ calls) |
| `/auth/strava/callback` | `StravaCallback` | Y | `ProtectedRoute` | No | `functions.invoke` |
| `/clubs` | `Clubs` | Y | — | No | Direct Supabase |
| `/clubs/create` | `CreateClub` | Y | `ProtectedRoute` | No | Direct Supabase + Storage |
| `/clubs/:slug` | `ClubDetail` | Y | — | No | Direct Supabase |
| `/leaderboard` | `Leaderboard` | Y | — | No | Direct RPC |
| `/blog` | `Blog` | Y | — | **Yes** | Direct Supabase |
| `/blog/:slug` | `BlogPost` | Y | — | **Yes** | Direct Supabase |
| `/gallery` | `Gallery` | Y | — | **Yes** | Direct Supabase |
| `/contact` | `Contact` | Y | — | **Yes** | Direct Supabase |
| `/admin` | `Admin` | Y | `AdminRoute` | **Yes** | Placeholder |
| `*` | `NotFound` | Y | — | **Yes** | — |

SEO coverage: **6 / 16** routes use `<SEO/>`. The public commercial pages (`/`, `/challenges`, `/challenges/:slug`, `/clubs`, `/clubs/:slug`, `/leaderboard`) are missing per-page meta — they fall back to the generic `index.html` title/description.

## State management

| Concern | Pattern | Location |
|---|---|---|
| Auth + roles | React Context | `src/hooks/useAuth.tsx` |
| Server data (Challenges) | React Query | `src/features/challenges/hooks/*` |
| Server data (all other domains) | Direct `supabase.from(...)` + `useEffect` + `useState` | `src/pages/*` |
| Form state | `react-hook-form` + `zod` resolvers | `Contact`, `RegistrationModal`, etc. |
| Toast / sonner | shadcn `use-toast` | global |
| Theme | None (single light theme) | n/a |
| Global state library | **None** (no Redux, no Zustand) — intentional per stated preference | — |

## React Query inventory

Only **3 hooks** exist today:

| Hook | Type | Query key | File |
|---|---|---|---|
| `useChallenges` | `useQuery` | `qk.challenges.list()` | `src/features/challenges/hooks/useChallenges.ts` |
| `useChallengeDetail(slug)` | `useQuery` | `qk.challenges.detail(slug)` | `src/features/challenges/hooks/useChallengeDetail.ts` |
| `useRegisterChallenge()` | `useMutation` | invalidates `qk.registrations.all` | `src/features/challenges/hooks/useRegisterChallenge.ts` |

`useAuth` calls `useQueryClient().clear()` on sign-out — correct.

### Query defaults (`src/main.tsx`)

```ts
staleTime: 60_000,
gcTime: 5 * 60_000,
refetchOnWindowFocus: false,
retry: 1,
```

Reasonable. `retry: 1` may mask transient failures during launch — consider `retry: 2` once monitoring is live.

## Anti-patterns / risks

| # | Issue | Location | Severity |
|---|---|---|---|
| F1 | **Fetch-in-`useEffect` + manual loading state** in 8 pages instead of React Query — no caching, no deduplication, no retry. | Dashboard, Clubs, ClubDetail, Blog, Gallery, Leaderboard, Contact, BlogPost | High |
| F2 | **Client-side milestone unlock** writes to `activity_logs`, `registrations`, `user_milestones` non-atomically. | `Dashboard.tsx:217-260` | High |
| F3 | `useRegisterChallenge` invalidates `qk.challenges.detail("")` — empty-string key never matches a real query. | `useRegisterChallenge.ts` | Low |
| F4 | `<SEO/>` reads `window.location.pathname` for canonical URL — fine in CSR, but no absolute base means crawlers see relative canonicals. Acceptable until a domain is published. | `src/components/SEO.tsx` | Low |
| F5 | Duplicate Supabase client export (`src/lib/supabaseClient.ts`) invites confusion. | `src/lib/supabaseClient.ts` | Low |
| F6 | `useRegisterChallenge.onSuccess` calls `monitoring.trackEvent` — good — but no event taxonomy exists yet. | n/a | Info |

## Recommendations (frontend)

1. Migrate Dashboard, Clubs, Blog, Gallery, Leaderboard, Contact verticals to feature hooks (priority order in [Roadmap](./16-roadmap.md)).
2. Add `<SEO/>` to every public route; introduce a `useSEO()` helper or a layout-level meta builder.
3. Fix `useRegisterChallenge` invalidation: invalidate by `qk.challenges.all` or pass the slug into the mutation args.
4. Delete `src/lib/supabaseClient.ts` and `src/App.css` after confirming no imports.
