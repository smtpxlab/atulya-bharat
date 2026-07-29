# Navigation Stability Audit

Date: 2026-06-16
Scope: Eliminate page blinking, double renders, full-page-refresh feel, and layout remounts across the public site and admin app.

## Symptoms (before)

- Visible flash when navigating to `/dashboard` and `/admin/*`.
- Cold load of authenticated routes showed a cascade of loaders (auth spinner → roles spinner → route skeleton → page).
- Every public/admin page nav flashed a large skeleton grid.
- Token refresh events caused `useAuth` consumers to re-render even though the user was unchanged.

## Provider / route tree

```
ReduxProvider
  HelmetProvider
    QueryClientProvider          ← single QueryClient (module-scope singleton)
      App
        TooltipProvider
          BrowserRouter
            AuthBootstrap        ← mounts once, subscribes to onAuthStateChange
            ErrorBoundary
              Routes
                SiteLayout       (persistent — Navbar + Footer + <Outlet/>)
                AdminRoute → AdminLayout (persistent — Sidebar + Header + <Outlet/>)
                /login /signup /auth/strava/callback (no chrome)
```

No `<StrictMode>` is in use; observed double renders were not StrictMode artifacts.

## Root causes and fixes

| Symptom | Root cause | Fix |
|---|---|---|
| Skeleton flash on every public nav | `<Suspense fallback={<RouteSkeleton/>}>` in SiteLayout + every page lazy | Eager-imported hot pages, swapped fallback to `null` |
| Skeleton flash on every admin nav | Same pattern in AdminLayout, every admin page lazy | Eager-imported all admin pages, swapped fallback to `null` |
| Full-screen spinner overlay on `/dashboard` and `/admin` cold load | `UserRoute` / `AdminRoute` returned a `min-h-screen` loader during `loading || rolesLoading`, hiding the layout chrome | Guards now return `null` while gating so Navbar/Sidebar/Header paint immediately and only the `<main>` content area is briefly empty |
| `useAuth` consumers re-rendered on `TOKEN_REFRESHED` | `sessionLoaded` reducer replaced `session`/`user` references on every auth event | Reducer now no-ops when `access_token` and `user.id` are unchanged, preserving object identity |
| Duplicate `sessionLoaded` dispatch on cold load | Both `onAuthStateChange` (INITIAL_SESSION) and the `getSession()` `.then` dispatched | Reducer no-op + role-fetch already guarded by `loadedForUserId` ref make the second dispatch a true no-op |
| Avoidable Navbar re-renders | `initials` recomputed inline | Wrapped in `useMemo` |

## Lazy vs eager split

Eager (in the main bundle):
- `Index`, `Login`, `Signup`, `Challenges`, `Dashboard`, `Clubs`, `Leaderboard`, `Blog`, `Gallery`, `Contact`, `NotFound`
- All admin pages (the entire admin module is gated behind auth, so code-splitting it does not help anonymous first paint and would only flash on every admin nav)

Lazy (route-scoped, larger, less frequent):
- `ChallengeDetail`, `BlogPost`, `ClubDetail`, `CreateClub`, `StravaCallback`

## Auth lifecycle

1. `AuthBootstrap` mounts once inside `BrowserRouter`.
2. Subscribes to `onAuthStateChange` first, then calls `getSession()` (Supabase deadlock avoidance pattern).
3. On each event:
   - Dispatches `sessionLoaded`; reducer no-ops if the session is effectively unchanged.
   - If a user id is present and differs from the last-fetched id (`loadedForUserId` ref), schedules a one-shot `user_roles` fetch via `setTimeout(0)`.
4. On `SIGNED_OUT`, the ref clears and React Query cache is dropped.

Result: exactly one `user_roles` request per signed-in user per session; zero refetches on subsequent navigations or token refreshes.

## React Query

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

No duplicate-query patterns observed in the services scanned during this audit.

## Verification checklist

- [x] `SiteLayout`, `AdminLayout`, `Navbar`, `Footer`, `AdminSidebar`, `AdminHeader` are all eagerly imported.
- [x] No `key={pathname}` anywhere in the route tree.
- [x] No `window.location.href = "/internal"` / `window.reload` / `<a href="/internal">` for internal navigation. Remaining `window.location.*` calls are external (Strava OAuth) or canonical-URL/redirectTo string building.
- [x] Guards return `null` while gating, not a full-screen loader.
- [x] Suspense fallbacks inside persistent layouts are `null`.
- [x] Most pages are eagerly imported; only the heavy/rare ones remain lazy.
- [x] `sessionLoaded` is identity-preserving on token refresh.

## Out of scope

No new features, no schema/RLS/service/edge-function changes, no Redux additions for server data, no changes to admin functionality or the `useAuth` API shape.
