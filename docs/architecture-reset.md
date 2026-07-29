# ABR Architecture Reset — Website First

Goal: simplify ABR to a **website-only** React project. No mobile-app design
constraints, no multi-client API abstractions, no future-backend wrappers.

## Before

```text
React + Vite
├─ React Router
├─ React Query (server cache) + scattered useState for UI/auth/sidebar
├─ useAuth Context (session, roles)
├─ Service layer
│   ├─ src/services/*                       direct supabase (public site)
│   └─ src/features/admin/services/adminApi.ts
│       ├─ supabase/functions/admin-api     edge-function shim (default)
│       └─ /backend Express app             via VITE_ADMIN_API_URL (unused)
└─ Lovable Cloud (Supabase) — auth, RLS, tables
```

## Complexity removed (introduced for future-app support)

| Removed | Why |
|---|---|
| `/backend` Express app | Not consumed by the website; was a Node mirror for "future portability" |
| `supabase/functions/admin-api` | Wrapped queries the client can do directly under RLS |
| `src/features/admin/services/adminApi.ts` | Dual edge/Node switch + bespoke fetch envelope |
| `AdminApiMode` banner in `AdminLayout` | Surfaced an abstraction users don't need |
| `src/components/auth/RoleRoute.tsx` | Generic role gate; only `AdminRoute` is used |
| `VITE_ADMIN_API_URL` | Env switch for non-existent backend |

## After

```text
React + Vite
├─ React Router (single BrowserRouter)
│   ├─ <SiteLayout/>  → public + authenticated pages (persistent Navbar/Footer)
│   ├─ /login /signup /auth/strava/callback (no chrome)
│   └─ /admin/* → <AdminRoute><AdminLayout/></AdminRoute> (persistent sidebar)
│
├─ Redux Toolkit (global state)
│   src/store/
│     index.ts
│     slices/authSlice.ts    user, session, roles, loading flags
│     slices/uiSlice.ts      sidebar, theme
│     slices/adminSlice.ts   admin list filters (challenges, clubs, milestones)
│
├─ React Query (server cache only)
│   challenges, clubs, milestones, blog, gallery, dashboard, …
│
└─ Lovable Cloud (Supabase) — direct from client, RLS enforced
```

## Route tree (final `src/App.tsx`)

```tsx
<BrowserRouter>
  <AuthBootstrap />
  <Routes>
    <Route element={<SiteLayout />}>
      <Route index path="/" element={<Index />} />
      <Route path="/challenges"   element={<Challenges />} />
      <Route path="/challenges/:slug" element={<ChallengeDetail />} />
      <Route path="/clubs"        element={<Clubs />} />
      <Route path="/clubs/:slug"  element={<ClubDetail />} />
      <Route path="/clubs/create" element={<Protected><CreateClub/></Protected>} />
      <Route path="/leaderboard"  element={<Leaderboard />} />
      <Route path="/blog"         element={<Blog />} />
      <Route path="/blog/:slug"   element={<BlogPost />} />
      <Route path="/gallery"      element={<Gallery />} />
      <Route path="/contact"      element={<Contact />} />
      <Route path="/dashboard"    element={<Protected><Dashboard/></Protected>} />
      <Route path="*" element={<NotFound />} />
    </Route>

    <Route path="/login"  element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/auth/strava/callback" element={<Protected><StravaCallback/></Protected>} />

    <Route path="/admin" element={<AdminRoute><AdminLayout/></AdminRoute>}>
      <Route index element={<AdminDashboardPage />} />
      <Route path="challenges/*" element={…} />
      <Route path="clubs/*"      element={…} />
      <Route path="milestones/*" element={…} />
      <Route path="categories|coupons|…" element={<ComingSoonPage/>} />
    </Route>
  </Routes>
</BrowserRouter>
```

Layout shells (`SiteLayout`, `AdminLayout`) are eagerly imported so they mount
once; only the `<Outlet />` content swaps on navigation.

## Redux structure

- `authSlice` — owned by `<AuthBootstrap/>` which subscribes once to
  `supabase.auth.onAuthStateChange`. Token refresh / focus echoes do **not**
  reflip `rolesLoading`.
- `uiSlice` — sidebar open state and theme (persisted to local component
  state today; can be persisted later if needed).
- `adminSlice` — search/status/page filters for admin list pages, so filters
  survive navigation between list and detail.
- `useAuth()` is now a thin selector wrapper over `authSlice` so existing
  consumers (`AdminRoute`, `ProtectedRoute`, `Dashboard`, `Navbar`, …) keep
  working unchanged.

React Query keeps its single role: **server data fetching and caching**.

## Files removed

- `backend/**`
- `supabase/functions/admin-api/**`
- `src/features/admin/services/adminApi.ts`
- `src/components/auth/RoleRoute.tsx`
- `getApiMode()` banner block in `src/features/admin/layout/AdminLayout.tsx`

## Files refactored

| File | Change |
|---|---|
| `src/main.tsx` | Wrap app in `<Provider store={store}>` |
| `src/App.tsx` | Single, flat route tree per spec |
| `src/hooks/useAuth.tsx` | Selector over `authSlice`, same return shape |
| `src/features/auth/AuthBootstrap.tsx` | New — owns Supabase auth listener |
| `src/features/admin/services/challenges.admin.ts` | Direct `supabase.from('challenges')` calls |
| `src/features/admin/services/club.admin.service.ts` | Direct supabase + join select |
| `src/features/admin/services/milestone.admin.service.ts` | Direct supabase |
| `src/features/admin/services/dashboard.admin.ts` | Direct `head:true` counts |
| `src/features/admin/layout/AdminLayout.tsx` | Banner removed |
| `src/features/admin/pages/{challenges,clubs,milestones}/*ListPage.tsx` | Filter state read from `adminSlice` |

## Migration order followed

1. Install `@reduxjs/toolkit` + `react-redux`; add `src/store/`.
2. Add `AuthBootstrap` and port `useAuth` to a Redux selector.
3. Rewrite admin services to call Supabase directly (RLS enforces `has_role('admin')`).
4. Remove `adminApi.ts`, `admin-api` edge function, `/backend`, `RoleRoute`, banner.
5. Simplify `App.tsx` to the target tree.
6. Move admin list filters into `adminSlice`.

## Constraints honored

- No DB schema changes
- No RLS policy changes
- No admin feature changes
- No UI redesign
- No new functionality
- Public services, Zod schemas, payment + Strava edge functions untouched

## Outcome

- `App.tsx` is a single flat `Routes` tree, readable in well under five minutes.
- Navbar/Footer + Admin sidebar/header persist across navigation.
- One global state library (Redux Toolkit), one server cache (React Query).
- Admin pages talk to Lovable Cloud directly, gated by RLS — no shim layer.
