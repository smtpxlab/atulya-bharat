# Navigation & Remount Audit — 16 Jun 2026

## Verdict
Three remount sources identified and fixed. Providers, layouts, and the admin
shell now mount exactly once for the lifetime of the session; only `<Outlet />`
content swaps on navigation.

## Root causes & fixes

### 1. Public Navbar/Footer remounted on every navigation (PRIMARY)
**Evidence (before fix):** Every public page rendered its own `<SiteLayout>`
wrapper, e.g. `src/pages/Index.tsx:8`, `Challenges.tsx:76`, `Clubs.tsx:80`,
`Blog.tsx:59`, `BlogPost.tsx:108`, `ChallengeDetail.tsx:109`,
`ClubDetail.tsx:241`, `Gallery.tsx:74`, `Contact.tsx:48`,
`Leaderboard.tsx:137`, `Dashboard.tsx:377`, `CreateClub.tsx:109`,
`NotFound.tsx:15`. Because the route `element` changed between pages, the
page (and its `SiteLayout`) unmounted/remounted — Navbar and Footer
were torn down on every link click.

**Fix:**
- `src/components/layout/SiteLayout.tsx` — now renders `<Outlet />` (with
  its own `<Suspense fallback={<RouteSkeleton />}>`) instead of `children`.
- `src/App.tsx` — public routes are wrapped in a single layout route
  `<Route element={<SiteLayout />}>…</Route>`. SiteLayout mounts once;
  only the outlet swaps.
- All 13 page files: removed `import { SiteLayout }` and replaced the
  outer `<SiteLayout>…</SiteLayout>` wrapper with React fragments.

### 2. AdminRoute re-rendered a full-screen loader on token refresh
**Evidence (before fix):** `src/hooks/useAuth.tsx` set `rolesLoading=true`
on every `onAuthStateChange` event, including `TOKEN_REFRESHED` and the
`SIGNED_IN` echo Supabase emits on tab focus. `src/components/auth/AdminRoute.tsx:11`
returns a full-screen `Loader2` whenever `rolesLoading` is true, which
unmounts `AdminLayout` (sidebar + header + state).

**Fix:** `src/hooks/useAuth.tsx` now tracks the user id whose roles have
already been loaded (`loadedRolesForUserId` ref). Roles are only refetched
when the user id actually changes; same-user auth events leave `rolesLoading`
alone, so `AdminRoute` never flips back to the loader mid-session.

### 3. AdminLayout shell was code-split (lazy-loaded)
**Evidence (before fix):** `src/App.tsx:30` —
`const AdminLayout = lazy(() => import(...))`. The only Suspense above it
was the root `L()` wrapper, so any time the chunk wasn't cached the entire
admin shell suspended and rendered `RouteSkeleton` — looking identical to a
full-page refresh.

**Fix:** `src/App.tsx` now imports `AdminLayout` and `SiteLayout` eagerly.
Page components remain lazy; suspense boundaries live inside the layouts so
chunk loads only swap `<main>`.

## Confirmed clean (no changes needed)
- Single `BrowserRouter` (`src/App.tsx`), single `QueryClient`
  (`src/main.tsx:10`).
- No internal `<a href>` links; sidebar uses `NavLink`; navbar uses `Link`/`NavLink`.
- No `navigate(0)` / `window.reload` / `key={pathname}`. Only
  `window.location.href` write is the Strava OAuth redirect
  (`src/pages/Dashboard.tsx:333`); `window.location.origin` reads build
  redirect URLs for auth — both correct.
- React StrictMode is not enabled, so dev-only double-mounts are not a
  factor.
- SPA hosting fallback is provided by Lovable infra automatically.

## Architecture (after fix)

```text
<TooltipProvider>
  <BrowserRouter>
    <AuthProvider>                 // mounts once
      <ErrorBoundary>              // mounts once
        <Routes>
          <Route element={<SiteLayout/>}>     // mounts once for all public nav
            ├ / (Index)            lazy
            ├ /challenges          lazy
            ├ /clubs, /clubs/:slug lazy
            ├ /blog, /blog/:slug   lazy
            ├ /gallery, /contact   lazy
            ├ /leaderboard         lazy
            ├ /dashboard (Protected) lazy
            └ * (NotFound)         lazy
          </Route>
          <Route /login>, /signup, /auth/strava/callback  (no chrome)
          <Route /admin element={<AdminRoute><AdminLayout/></AdminRoute>}>
            ├ index, challenges/*, clubs/*, milestones/*  lazy children
            └ Suspense lives inside AdminLayout around <Outlet/>
          </Route>
        </Routes>
      </ErrorBoundary>
    </AuthProvider>
  </BrowserRouter>
</TooltipProvider>
```

## Success-criteria check
| Requirement | Status |
| --- | --- |
| Providers mount once | ✅ AuthProvider/QueryClient/Tooltip/BrowserRouter all above Routes |
| Public Navbar/Footer persist across nav | ✅ SiteLayout is a layout route |
| AdminLayout/Sidebar/Header persist across `/admin/*` nav | ✅ AdminLayout eager + stable AdminRoute gate |
| Only `<Outlet/>` content changes | ✅ |
| No full-screen skeleton between admin tabs | ✅ Suspense scoped to `<main>` |
| React Query cache persists | ✅ QueryClient singleton, providers never remount |
| Auth state persists across nav | ✅ AuthProvider above Routes |
| No `window.location.*` for internal nav | ✅ only OAuth redirect |
| No internal `<a href>` | ✅ |

## Files changed
- `src/App.tsx`
- `src/components/layout/SiteLayout.tsx`
- `src/hooks/useAuth.tsx`
- `src/pages/Index.tsx`, `Challenges.tsx`, `Clubs.tsx`, `Blog.tsx`,
  `BlogPost.tsx`, `ChallengeDetail.tsx`, `ClubDetail.tsx`, `Gallery.tsx`,
  `Contact.tsx`, `Leaderboard.tsx`, `Dashboard.tsx`, `CreateClub.tsx`,
  `NotFound.tsx` (removed `SiteLayout` wrapper)
