# Atulya Bharat Run — Senior Engineer Interview Guide

> Companion documents in this folder:
> - `elevator-pitch.md` — 60-second and 3-minute spoken answers, plus all "tell me about" follow-ups.
> - `api-reference.md` — every edge function and SQL routine.
> - `interview-qa.md` — 240 questions with answers (React, TS, Backend, DB, System Design, Project-specific).
> - `diagrams/*.mmd` — system architecture, auth flow, payment flow, Strava flow, request lifecycle, ER diagram.

Read this document top to bottom before an interview. It is written in first person as if I built it.

---

## 1. Project Understanding

### What the application does
Atulya Bharat Run is a **virtual running challenge platform** for the Indian market. A user picks a themed virtual route (e.g., 50 km Ayodhya Airport → Ram Mandir, or 250 km Char Dham), pays online, then runs in the real world. The platform maps their combined distance onto the virtual route, unlocks story-driven milestones as they cross thresholds, generates a personalised finisher certificate, and ranks them on leaderboards.

### Business problem
Physical marathons in India have massive latent demand but high friction — travel, accommodation, one-day events, limited slots. Virtual challenges convert intent-to-run into paid registrations year-round, monetise cultural themes (Ayodhya, Char Dham, Kanyakumari), and give organisers recurring revenue with no venue overhead.

### Target users
- **Recreational runners** who want structured goals with meaning.
- **Amateur athletes** already using Strava who want a leaderboard + certificate.
- **Community/club leaders** who organise runs and want a platform to host their group.
- **Admin/organizer** (internal) who manages catalog, prices, coupons, content, and reports.

### Core modules
Auth, Challenges (browse/detail), Registration + Checkout (Razorpay), Strava integration (OAuth + webhook + cron sync + manual sync), Activity Log + Progress engine, Milestones + Certificates, Leaderboard (global + per-challenge), Clubs (create/join/list), Blog + Pages CMS, Gallery + Testimonials + FAQs, Notifications (in-app realtime), Newsletter, Contact form, Admin CMS (15+ sections), SEO (per-page metadata + JSON-LD + sitemap).

### Main workflows
1. Browse → Register → Pay → Get BIB.
2. Connect Strava → Run → Automatic progress → Milestone unlocked → Certificate on completion.
3. Manual activity log (fallback when Strava is not connected).
4. Admin: create challenge → define tickets → define milestones with media → publish → monitor participants + revenue.

### Functional requirements
- Payments (Razorpay INR, coupons, multiple ticket tiers per challenge).
- OAuth with Strava, webhook + cron + manual sync, sport filter per challenge mode.
- Auto BIB and certificate generation.
- Realtime dashboard updates.
- Full admin CMS.
- Public content pages, SEO metadata per page.

### Non-functional requirements
- **Security**: RLS on every table, HMAC verification on payment callbacks, no secrets in the client.
- **Performance**: sub-second first meaningful paint on hot routes; realtime dashboard.
- **SEO**: Helmet metadata + sitemap + JSON-LD for public pages.
- **Reliability**: idempotent payment + Strava ingestion; cron safety net.
- **Portability**: no proprietary Lovable API in `src/` — 100% portable to stock Supabase.
- **Solo-dev maintainability**: strict Page → hook → service → SDK layering.

### User journey (registration → finish)
Landing → Challenges list → Challenge detail → "Join" → Login/Signup (if needed) → Select ticket → Apply coupon → Razorpay Checkout → Success page with BIB → Dashboard → Connect Strava → Run → Realtime progress → Milestone unlock notification → Complete → Certificate.

---

## 2. Complete Tech Stack

### Frontend
| Tech | Why chosen | Alternatives | Where used |
|------|------------|--------------|------------|
| **React 18** | Ecosystem, concurrent features (Suspense, transitions), shadcn/Radix pattern. | Vue, Svelte. | Whole SPA. |
| **TypeScript** | End-to-end types via generated `Database` type; catches API drift at build time. | Plain JS + JSDoc. | Every file. |
| **Vite 5** | Instant HMR (native ESM in dev), Rollup for prod, first-class TS. | Next.js, CRA, webpack. | Bundler/dev server. |
| **React Router v6** | Nested layouts, `element` API, lazy loading. | TanStack Router. | `src/App.tsx`. |
| **Redux Toolkit** | Selective subscription via `useSelector`, avoids Context re-render fan-out for session/roles. | Zustand, Jotai, Context. | `src/store/`, auth + UI. |
| **TanStack Query** | Cache + refetch + invalidation; ideal for server state. | SWR, RTK Query. | Every data hook. |
| **React Hook Form + Zod** | Uncontrolled forms → fast large forms; Zod = single-source shape for form + API. | Formik, Yup. | All admin forms. |
| **Tailwind CSS** | Consistent design tokens via CSS vars; no CSS-in-JS runtime. | CSS Modules, Emotion. | Whole UI. |
| **shadcn/ui + Radix** | Own the components, accessibility from Radix, no vendor lock-in. | MUI, Chakra. | `src/components/ui/*`. |
| **Lucide icons** | Tree-shakable, consistent. | Heroicons, FA. | Everywhere. |
| **TipTap** | Extensible headless rich-text editor. | Slate, Quill. | Blog + Milestone + Pages CMS. |
| **react-helmet-async** | Per-route metadata for SPA SEO. | react-head. | `SEO` component. |
| **date-fns** | Tree-shakable, immutable, locale-aware. | moment, dayjs. | Dates everywhere. |
| **html2canvas + jsPDF** | Client-side cert generation without server render. | Puppeteer. | Certificate page. |
| **DOMPurify** | XSS-safe rich-text render. | sanitize-html. | `SafeHtml`. |
| **@supabase/supabase-js** | Auth + PostgREST + Realtime + Storage + Functions in one client. | Custom fetch. | `src/integrations/supabase/`. |

### Backend (Lovable Cloud = Supabase)
| Tech | Why | Where |
|------|-----|-------|
| **Postgres 15** | Relational domain, RLS, triggers, `jsonb`, mature. | All data. |
| **PostgREST** | Auto REST from schema; less code, RLS enforces auth. | Every table with GRANTs. |
| **GoTrue Auth** | Managed email/OAuth + JWT + refresh. | Login/signup. |
| **Deno Edge Functions** | Web APIs, per-request isolation, TS OOTB, secrets. | `supabase/functions/` (15 fns). |
| **Storage** | S3-compatible with bucket-level RLS. | 10 buckets. |
| **Realtime** | Postgres WAL → WebSocket. | Dashboard, notifications. |
| **pg_cron** | Scheduled jobs in-DB. | Strava safety-net sync. |

### Integrations
- **Razorpay** — INR checkout + webhooks.
- **Strava** — OAuth + activity webhook + Athlete API.
- **SMTP** (Resend / configured provider) — transactional email via GoTrue + `contact-form`.

### Tooling
ESLint, TypeScript, Vitest (unit), Bun (package manager), Playwright (ad-hoc audits).

---

## 3. Overall System Architecture

```
Browser (React SPA + Vite)
     │  supabase-js
     ▼
┌────────────────────────────┐
│   Auth (GoTrue) │ PostgREST │ Realtime │ Storage │ Edge Functions
└────────────────────────────┘
     │  SQL / Triggers / RPCs
     ▼
  Postgres 15  ─────────────► pg_cron ──► Edge Functions ──► Razorpay / Strava / SMTP
```

Mermaid diagrams:
- `diagrams/system-architecture.mmd`
- `diagrams/auth-flow.mmd`
- `diagrams/payment-flow.mmd`
- `diagrams/strava-flow.mmd`
- `diagrams/request-lifecycle.mmd`
- `diagrams/er-diagram.mmd`

### Request lifecycle (read)
Page → feature hook → React Query → service → `supabase-js` → PostgREST (JWT attached) → RLS filters rows → response → domain type mapping → cache → component render.

### Request lifecycle (write with secret)
Component → service → `supabase.functions.invoke(...)` → Deno Edge Function → verify + call third-party + `service_role` client → DB triggers → response → client invalidates cache → UI updates.

### Auth flow
`AuthBootstrap` listens to `onAuthStateChange`. On SIGNED_IN it reads `user_roles`, dispatches session + roles. On SIGNED_OUT it targeted-clears React Query and Redux. Route guards read Redux. **Real** enforcement is RLS + `has_role()`.

### Authorization
Postgres RLS is the single source of truth. `public.has_role(uid, role)` is `SECURITY DEFINER STABLE` with fixed `search_path` to avoid RLS recursion; every admin policy references it.

### Error flow
`ServiceError` on the client → surfaced as toast; ErrorBoundary catches render errors + lazy chunk failures; edge fns return `{ error: { code, message } }` with HTTP status.

### Data flow (realtime)
Postgres change → logical replication → Realtime service → WebSocket → client channel handler → `queryClient.invalidateQueries(key)` → refetch → re-render.

---

## 4. Frontend Architecture

### Folder structure (top level of `src/`)
```
src/
├── App.tsx                 # Router + providers
├── main.tsx                # ReactDOM.createRoot, monitoring.init
├── integrations/supabase/  # Auto-generated client + Database type
├── lib/                    # queryClient, queryKeys, supabaseClient re-export, monitoring, seo
├── store/                  # Redux slices (auth, ui) + hooks
├── features/
│   ├── auth/               # AuthBootstrap, route guards
│   ├── admin/              # Admin layout + sidebar + module routes
│   ├── blog/, challenges/, clubs/, dashboard/, registrations/
├── pages/                  # Route components (Home, ChallengeDetail, …)
├── components/
│   ├── ui/                 # shadcn primitives
│   ├── shared/             # SEO, Breadcrumbs, SafeHtml, ProtectedRoute, …
│   ├── challenges/, clubs/, dashboard/, …  # feature widgets
├── hooks/                  # Cross-feature hooks (useMediaQuery, useDebounce, …)
├── services/               # Every DB/edge-function call
├── schemas/                # Zod schemas
├── types/                  # Domain types (mapped from Database)
└── assets/                 # Images bundled into build
```

### Routing
`BrowserRouter` in `App.tsx`. Public routes and `<SiteLayout>` children; admin routes under `<AdminLayout>`. Guards (`ProtectedRoute`, `UserRoute`, `AdminRoute`) wrap `element`. Hot routes are eager; heavy/rare routes are `React.lazy` with route-specific skeleton fallbacks. `ScrollToTop` + `RouteProgress` mounted globally.

### State strategy
- **Server state** → React Query (keys centralised in `lib/queryKeys.ts`, `placeholderData: prev` for smooth transitions, invalidation from realtime channels).
- **Auth + UI** → Redux Toolkit (selective subscription; avoids Context re-render fan-out).
- **Component-scoped** → `useState`.
- **Form** → RHF's internal store.

### API layer
Single `supabase-js` instance (`src/integrations/supabase/client.ts`, re-exported by `src/lib/supabaseClient.ts`). Services live in `src/services/*.service.ts`. Hooks live in `src/features/**/hooks/*` (or `src/hooks`). **Rule**: components never import supabase-js directly; they go through a hook that calls a service.

### Performance
- `React.lazy` per route.
- `React.memo`/`useMemo`/`useCallback` used surgically (only where profiler flagged wasted renders).
- Realtime → no polling.
- Vite `dedupe` for `react` and `@tanstack/react-query`.
- Tree-shakable icons and date-fns.
- Route-level skeletons prevent CLS.

### Accessibility & SEO
Radix under shadcn gives keyboard nav + ARIA. `SEO` component + JSON-LD (`SportsEvent`, `SportsClub`, `WebSite`, `BreadcrumbList`) per page. Sitemap generated in `predev`/`prebuild`.

### Error handling
Global + per-route `ErrorBoundary`. Query errors → toast. Chunk load fail → retry UI.

---

## 5. React + TypeScript Deep Dive
See `interview-qa.md` sections **React (50)** and **TypeScript (50)** for interview-ready coverage of Fiber, reconciliation, hooks internals, stale closures, controlled vs uncontrolled, memoization, generics, mapped/conditional types, Zod inference, etc. Every entry is grounded in this codebase.

---

## 6. Backend Architecture

There is no bespoke Node process. The "backend" is Postgres + PostgREST + Deno Edge Functions.

### Layers
1. **PostgREST** exposes tables as REST. Auth is RLS. Composability via `select=id,name,children(*)`.
2. **RPCs** (plpgsql / SQL) for anything needing joins across policies or atomic multi-write. Called via `supabase.rpc(...)`.
3. **Edge Functions** (Deno, `supabase/functions/`) for secrets, third-party APIs, signature verification. Called via `supabase.functions.invoke(...)`.
4. **Triggers** enforce invariants regardless of caller (BIB, certificate, denorm counts, notification generation, guard rails).

### Middleware equivalents
- **Auth** — every request carries the JWT; PostgREST extracts `auth.uid()` for RLS.
- **Validation** — Zod in both client and edge fns.
- **Rate limiting** — Supabase per-IP for auth; custom in `contact-form`.
- **Logging** — `console.log` visible in Function Logs.
- **Error handling** — consistent envelope in edge fns; `ServiceError` on client.

### Business logic placement
- **In DB (triggers/RPCs)** — anything that must hold under any caller (registration progress recomputation, BIB, certificate, club owner seeding, notifications).
- **In edge fns** — flows with third-party APIs or secrets (Razorpay verify, Strava OAuth/webhook).
- **In client** — presentation, form UX, view aggregation.

---

## 7. Database Design
See `diagrams/er-diagram.mmd` for the visual and `docs/PROJECT_DOCUMENTATION.md` for full schema.

### Highlights
- **`user_roles`** separate from `profiles` — prevents self-escalation.
- **`has_role(uid, role)`** — SECURITY DEFINER, STABLE, fixed `search_path`; referenced by every admin policy.
- **`registrations`** — one per user per challenge; BIB assigned by trigger; `total_distance_km` denormalised.
- **`activity_logs`** — UNIQUE on `(strava_activity_id)` for idempotency; trigger recomputes registration total on any change.
- **`challenge_milestones` + `user_milestones`** — thresholds and per-user unlocks; trigger inserts unlocks + notifications.
- **`orders`** — sequential `booking_number` via trigger; delete blocked for audit safety.
- **`clubs` + `club_members`** — owner-seed on insert, last-owner-delete blocked.
- **Everything money** is integer paise. Everything time is `TIMESTAMPTZ`.

### Indexes
All FKs, unique constraints on natural keys (`slug`, `strava_activity_id`, `bib_number`), composite indexes on hot lookup pairs (`activity_logs(registration_id, activity_date)`, `orders(user_id, status)`).

### Migrations
74 forward-only SQL files in `supabase/migrations/`. Each new column/policy is a new file. Never edit historical migrations — write a compensating migration.

---

## 8. API Documentation
See **`api-reference.md`** — every edge function (method, body, logic, errors) and every SQL routine (RPC or trigger).

---

## 9. Authentication & Authorization
Covered in §3 and §6. Signup/login/reset/verify are GoTrue-managed. Authorization is Postgres RLS + `has_role()`. Route guards mirror this in the UI for UX only.

---

## 10. Admin Panel

Layout in `src/features/admin/layout/AdminLayout.tsx` with `AdminSidebar.tsx`. Modules:
- **Dashboard** — KPI cards (registrations, revenue, active users) from `admin_booking_stats` RPC.
- **Challenges** — CRUD, ticket tiers, milestones with media, SEO fields.
- **Clubs** — CRUD, social links, member management.
- **Blog** — TipTap editor, categories, SEO fields.
- **Pages** — CMS for static pages.
- **Gallery / Testimonials / FAQs** — CRUD.
- **Coupons** — codes, discount type, max uses, expiry.
- **Orders / Bookings** — searchable list from `admin_booking_stats`.
- **Participants** — per-challenge participants via `admin_list_challenge_participants`.
- **Payment Settings** — Razorpay gateway credentials + toggle.
- **Strava** — subscription health, cron status.
- **Notifications / Newsletter** — send + subscriber list.
- **Contact enquiries** — inbox with status.

Every admin write hits RLS policies that reference `has_role('admin')`, so the security is not just UI.

---

## 11. Business Logic
See §3 flows and `api-reference.md`. Highlights:
- **Registration** — payment first, then FK-connected `registrations` row.
- **Progress** — triggers, not client math.
- **Milestone unlock** — triggers, single source of truth.
- **Certificate** — trigger stamps ID on completion.
- **Notifications** — trigger-inserted, realtime-delivered.
- **Search/filter/sort/pagination** — PostgREST query params; keys included in React Query keys for cache correctness.

---

## 12. Problems Solved

1. **Realtime channel collision** ("cannot add postgres_changes callbacks after subscribe()"). Root cause: two hook instances shared a channel name. Fix: per-instance UUID channel name. Lesson: identity of an external subscription must be per-consumer.
2. **RLS recursion** when admin policies referenced tables inside their own USING expression. Fix: SECURITY DEFINER `has_role()` with fixed `search_path`.
3. **Strava sport filter** — `ingest_failed` errors for Run-only challenges when Ride activities arrived. Added `_activity_type_matches_mode` and enforced at ingest.
4. **Milestone description rendered as raw HTML** — swapped in `SafeHtml` (DOMPurify) to render sanitized HTML.
5. **Public caches wiped on logout** — implemented `isAuthScopedQuery` predicate for targeted eviction.
6. **Suspense flashes on hot routes** — moved Home/Login/Dashboard to eager import.
7. **Horizontal scroll on ClubDetail (mobile)** — added `min-w-0` to sidebar `aside`.
8. **SEO in an SPA** — Helmet + JSON-LD + generated sitemap + centralised `SITE_URL`.
9. **Stale "Coming Soon" on Payment Settings** — leftover flag in `AdminSidebar.tsx`.
10. **Dashboard "0.0 km" rounding bug** — formatter used `toFixed(1)` on ints without guarding.

Every fix is documented in the commit history and `docs/audit/`.

---

## 13. Features Added
Auth, Challenges + Details, Registration, Razorpay Checkout, Coupons, Strava OAuth/Webhook/Cron/Manual, Activity Log, Progress engine, Milestones, Certificates, Leaderboards, Clubs, Blog + CMS Pages, Gallery/Testimonials/FAQ, Notifications (realtime), Newsletter, Contact form, Full Admin CMS (15+ modules), SEO metadata + sitemap + structured data, Responsive audit fixes.

For each, the pattern is the same: DB migration → RLS policy → optional trigger/RPC/edge fn → service → hook → page/component → SEO/telemetry.

---

## 14. Security
- **JWT** issued by GoTrue; auto-attached by supabase-js.
- **Password hashing** — bcrypt, managed by GoTrue.
- **RLS on every table**.
- **`has_role()`** to prevent self-escalation and RLS recursion.
- **HMAC-SHA256** signature verification on Razorpay callbacks.
- **Webhook secret** verified on strava-webhook subscription.
- **DOMPurify** on rich-text.
- **No secrets in the client** — everything sensitive is in Cloud secrets and only used inside edge functions.
- **CORS** whitelisted per edge function.
- **Input validation** with Zod at edges.
- **Env vars** typed via `vite-env.d.ts`; publishable anon key only in the client.

---

## 15. Performance Optimization
Route-level `React.lazy`, per-route skeleton fallbacks, eager-load hot routes, `placeholderData: prev`, targeted cache eviction, realtime instead of polling, DB indexes on hot lookups, denormalisation via triggers, tree-shakable icons/date-fns, Vite `dedupe`, image lazy-load in cards.

---

## 16. Deployment
Hosted on Lovable (managed CDN + edge). Preview, published, and custom-domain URLs. Migrations and edge functions deploy alongside the app. `predev`/`prebuild` scripts regenerate `public/sitemap.xml`. Monitoring hook (`monitoring.init()`) ready for Sentry/PostHog.

For a self-hosted option: standard Vite build → any static host; edge functions → Supabase self-hosted; migrations → `supabase db push`.

---

## 17. Testing
Vitest + Testing Library configured. Coverage is intentionally minimal today; my honest interview answer is: I'd add Playwright end-to-end tests for the payment and Strava flows first (highest business risk), then component tests for form validation, then unit tests for pure formatters/utilities.

---

## 18. Folder Structure
See §4 for the full tree, plus:
```
supabase/
├── functions/              # 15 Deno edge functions + _shared/
├── migrations/             # 74 forward-only SQL files
└── config.toml             # Managed by Cloud
public/
├── robots.txt              # Disallow private routes
├── sitemap.xml             # Regenerated on predev/prebuild
└── llms.txt                # AI crawler policy
scripts/
├── generate-sitemap.ts     # Queries public tables, writes sitemap
└── seed-admin.ts           # Convenience seeder
docs/
├── PROJECT_DOCUMENTATION.md
├── audit/                  # Per-module audit reports
└── interview/              # This folder
```

---

## 19. Interview Preparation
See **`interview-qa.md`** — 50 React, 50 TypeScript, 50 Backend, 30 Database, 30 System Design, 30 Project-specific.

---

## 20. "Explain Your Project" Answer
See **`elevator-pitch.md`** — 60-second version, 3-minute version, and canned answers to all the standard follow-ups (role, features, communication, state, why React/TS/DB/architecture, challenges, bugs, optimizations, what you'd improve).
