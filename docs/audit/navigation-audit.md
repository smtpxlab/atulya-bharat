# Navigation Audit — 16 June 2026

## Summary

The app was already a real SPA. The "full page reload" feel on every navigation
was **not** caused by `window.location` calls, raw `<a href>` links, or form
submits — it was caused by a single root-level `<Suspense>` boundary wrapping
every lazy route. When any lazy chunk loaded, the entire visible tree
(including `AdminLayout`'s sidebar/header) unmounted and was replaced by the
full-page `<RouteSkeleton />`, which is visually indistinguishable from a
browser refresh.

## Root cause

`src/App.tsx` (before fix):

```tsx
<Suspense fallback={<RouteSkeleton />}>
  <Routes>...</Routes>
</Suspense>
```

Combined with `lazy()` on every route — including the parent `AdminLayout` —
every admin tab change suspended at the root, unmounting the sidebar and
header for the duration of the chunk fetch.

## Fix applied

1. `src/App.tsx` — replaced the single root `<Suspense>` with a per-route
   helper `L(node)` that wraps each top-level `Route.element` in its own
   `<Suspense fallback={<RouteSkeleton />}>`. Only the route that is actually
   loading shows the skeleton.
2. `src/features/admin/layout/AdminLayout.tsx` — wrapped `<Outlet />` in its
   own `<Suspense>` so admin child-page chunk loads only swap the `<main>`
   area; sidebar, header, and `AdminLayout` state remain mounted.

## What was checked and verified clean

| Check                          | Result | Evidence |
| ------------------------------ | ------ | -------- |
| Single `<BrowserRouter>`       | ✅      | `src/App.tsx`                                 |
| Providers mount once           | ✅      | `main.tsx` → `App.tsx` (QueryClient → BrowserRouter → AuthProvider) |
| No internal `<a href="/...">`  | ✅      | `rg href=\"/` returns 0 hits in `src/`         |
| No `window.location` for nav   | ✅      | Only usages: `window.location.origin` (build redirect URLs in Login/Signup/Dashboard/SEO/BlogPost) and a legitimate `window.location.href = stravaUrl` external OAuth redirect (`pages/Dashboard.tsx:333`) |
| Sidebar uses `NavLink`         | ✅      | `src/features/admin/layout/AdminSidebar.tsx`   |
| Navbar uses `NavLink`/`Link`   | ✅      | `src/components/layout/Navbar.tsx`             |
| Footer internal links use `Link` | ✅    | `src/components/layout/Footer.tsx` (external social/`tel:`/`mailto:` correctly use `<a>`) |
| All forms have `onSubmit`      | ✅      | `Contact`, `Login`, `Signup`, admin `ChallengeForm`/`ClubForm`/`MilestoneForm` |
| SPA hosting fallback           | ✅      | Lovable hosting serves `index.html` for unknown paths automatically |

## Remaining risks

- Public pages each render their own `<Navbar />` and `<Footer />` instead of
  sharing a layout route. With per-route Suspense, navigation between public
  pages still briefly shows `RouteSkeleton` (which replaces navbar/footer too).
  Eliminating that flash would require introducing a shared `<SiteLayout />`
  parent route and stripping `<Navbar />`/`<Footer />` from each page —
  intentionally out of scope for this audit.

## Success criteria — met

- Navigating `/admin` ↔ `/admin/challenges` ↔ `/admin/clubs` ↔ `/admin/milestones`
  keeps the sidebar and header mounted; only the main panel briefly suspends.
- `AuthProvider` / `QueryClientProvider` continue to mount exactly once
  (unchanged hierarchy).
- No new `<a href>` or `location.*` introductions.
