# 02 — Folder Structure Audit

## Top level

```text
.
├─ src/                       # application code
├─ supabase/                  # migrations + edge functions + config
├─ public/                    # static assets (favicon, robots.txt, placeholder.svg)
├─ scripts/                   # dev-only seed scripts (seed-admin.ts)
├─ docs/audit/                # this audit (added in this turn)
├─ .lovable/                  # plan + agent state
├─ index.html                 # Vite entry, global meta defaults
├─ vite.config.ts             # Vite + SWC config
├─ tailwind.config.ts         # design tokens, theme
├─ tsconfig*.json             # strict TS config
├─ vitest.config.ts           # vitest config (1 example test only)
└─ package.json               # deps & scripts
```

## `src/` tree (classified)

| Path | Purpose | Status |
|---|---|---|
| `src/App.tsx` | Route table, lazy + Suspense + ErrorBoundary | Active |
| `src/main.tsx` | Root render, QueryClient, monitoring.init() | Active |
| `src/index.css` | Tailwind + design tokens | Active |
| `src/pages/` | 17 route components | Active (mixed: only Challenges migrated) |
| `src/components/` | Shared UI + domain components | Active |
| `src/components/ui/` | shadcn/ui primitives | Active (vendor) |
| `src/components/auth/` | `ProtectedRoute`, `AdminRoute`, `RoleRoute` | Active |
| `src/components/challenges/` | `ChallengeCard`, `RegistrationModal`, `RouteVisualiser` | Active |
| `src/components/dashboard/` | Modals, progress ring, milestone screens | Active |
| `src/components/home/` | `HallOfFameSection` | Active |
| `src/components/layout/` | `Navbar`, `Footer`, `SiteLayout` | Active |
| `src/components/SEO.tsx` | Helmet wrapper | Active (under-used — only 6 pages import) |
| `src/components/ErrorBoundary.tsx` | Class-based boundary, wired to monitoring | Active |
| `src/components/RouteSkeleton.tsx` | Suspense fallback | Active |
| `src/hooks/useAuth.tsx` | Auth context + roles | Active |
| `src/hooks/use-mobile.tsx`, `use-toast.ts` | shadcn helpers | Active |
| `src/features/` | New layered architecture root | Reserved — only `challenges/hooks` implemented; others are `.gitkeep` |
| `src/features/README.md` | Architectural contract | Active |
| `src/services/` | 10 service modules + `errors.ts` + `index.ts` | Active |
| `src/schemas/` | 7 Zod schemas + `index.ts` | Active |
| `src/types/` | 7 domain models + `index.ts` | Active |
| `src/lib/queryKeys.ts` | RQ key factory | Active |
| `src/lib/monitoring/index.ts` | No-op monitoring wrapper | Active (scaffold) |
| `src/lib/utils.ts` | `cn()` shadcn helper | Active |
| `src/lib/supabaseClient.ts` | Re-export of integration client | **Duplicate** — points to same client as `@/integrations/supabase/client` |
| `src/integrations/supabase/client.ts` | Auto-generated Supabase client | Active (do not edit) |
| `src/integrations/supabase/types.ts` | Auto-generated DB types | Active (do not edit) |
| `src/test/example.test.ts`, `setup.ts` | One placeholder vitest | Reserved (no real coverage) |
| `src/App.css` | Vite default boilerplate | **Legacy** (not imported anywhere — verify) |

## `supabase/` tree

```text
supabase/
├─ config.toml                            # only declares verify_jwt=false for strava-webhook & strava-config
├─ functions/
│  ├─ create-razorpay-order/index.ts      # auth-checked, server-trusted pricing
│  ├─ verify-razorpay-payment/index.ts    # Not reviewed in this audit
│  ├─ strava-config/index.ts              # public (verify_jwt=false), returns client_id
│  ├─ strava-connect/index.ts             # auth-checked, exchanges OAuth code
│  ├─ strava-sync-manual/index.ts         # auth-checked, refreshes token, ingests activities
│  ├─ strava-webhook/index.ts             # verify_jwt=false, signature check: Needs verification
│  └─ strava-webhook-setup/index.ts       # admin-only one-off setup helper (Needs verification)
└─ migrations/
   ├─ 20260416205358_*.sql                # initial schema (enums, tables, RLS, RPCs, triggers, storage buckets) — 383 lines
   ├─ 20260416212913_*.sql                # strava_tokens: add athlete name columns — 35 lines
   ├─ 20260416214444_*.sql                # club-logos bucket + policies, club_members table — 203 lines
   ├─ 20260416214508_*.sql                # tighten club-logos read policy — 9 lines
   ├─ 20260615070949_*.sql                # contact_enquiries table — 81 lines
   ├─ 20260615094607_*.sql                # extend app_role enum (club_owner, content_manager, super_admin)
   └─ 20260615094645_*.sql                # user_roles indexes + helper functions — 104 lines
```

## `public/`

| File | Notes |
|---|---|
| `favicon.ico` | Default Lovable favicon — needs branding |
| `placeholder.svg` | Boilerplate |
| `robots.txt` | Permissive, **no `Sitemap:` directive** and **no `sitemap.xml`** in repo |

## Dead / legacy / duplicate

| Finding | Path | Recommendation |
|---|---|---|
| Duplicate Supabase client wrapper | `src/lib/supabaseClient.ts` | Delete; consumers should import `@/integrations/supabase/client` |
| Vite boilerplate CSS | `src/App.css` | Verify not imported, delete |
| 7 `.gitkeep` placeholders under `src/features/` | `clubs`, `dashboard`, `blog`, `gallery`, `admin`, `auth`, `challenges/components` | Keep — intentional scaffold |

## Direct Supabase access from pages (anti-pattern)

| File | Calls |
|---|---|
| `src/pages/Dashboard.tsx` | 10+ (profiles, user_milestones, activity_logs INSERT, registrations UPDATE, strava_tokens DELETE, functions.invoke) |
| `src/pages/Clubs.tsx` | club_members, profiles |
| `src/pages/ClubDetail.tsx` | profiles, challenges, milestones |
| `src/pages/CreateClub.tsx` | storage upload + getPublicUrl |
| `src/pages/Blog.tsx`, `BlogPost.tsx` | blog_posts |
| `src/pages/Gallery.tsx` | challenges, gallery_images |
| `src/pages/Leaderboard.tsx` | RPCs |
| `src/pages/Contact.tsx` | contact_enquiries |
| `src/pages/StravaCallback.tsx` | functions.invoke("strava-connect") |
| `src/components/home/HallOfFameSection.tsx` | RPC |
| `src/components/dashboard/MilestoneLibraryDrawer.tsx` | milestones / media |

These are the next migration targets. See [§04 service-layer migration matrix](./04-service-layer.md).
