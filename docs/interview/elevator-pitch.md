# Elevator Pitch — Ready-to-Speak Answers

Use the 60-second version for "tell me about yourself / your project"; the 3-minute version when the interviewer says "walk me through it in detail".

---

## 60-second version

> Atulya Bharat Run is a virtual running platform I built end-to-end. Users pick a themed challenge — say, a 50 km virtual route from Ayodhya Airport to the Ram Mandir — pay through Razorpay, then log distance either manually or by connecting Strava. The platform tracks their progress in real time, unlocks story-driven milestones along the route, generates a personalized certificate on completion, and ranks them on leaderboards.
>
> The frontend is React 18 with Vite, TypeScript, TanStack Query for server state, Redux Toolkit for auth/UI state, Tailwind and shadcn/ui for the design system. The backend is a fully managed Postgres with PostgREST auto-generated APIs, Row Level Security as the authorization layer, Deno-based edge functions for the pieces that need secrets — Razorpay signature verification, Strava OAuth, webhooks — and pg_cron for the scheduled Strava safety-net sync.
>
> Two things I'm most proud of: automatic Strava sync via webhooks that flows through Postgres triggers and Supabase Realtime so the dashboard updates seconds after a run, and a strict Page → hook → service → SDK layering that keeps the codebase testable and lets us swap in a custom Node backend later without touching UI.

---

## 3-minute version

**What it is.** A virtual running challenge platform for the Indian market. Every challenge is a themed route — Ayodhya, Char Dham, Kanyakumari — with distance targets from 5 km to 250 km. Users register, run in the real world, and the app treats their combined distance as progress along that virtual route.

**Who it's for.** Recreational and amateur runners in India who want structured, culturally-themed goals plus a shareable certificate and leaderboard placement, without having to travel to a physical event.

**The core loop.**
1. Browse challenges → pay via Razorpay (INR, coupons, multiple ticket tiers).
2. Register → get a BIB number auto-assigned by a Postgres trigger.
3. Connect Strava (or log manually).
4. Every activity flows in — webhook first, cron every 15 minutes as safety net — and a trigger recomputes total distance, unlocks milestones as thresholds cross, and stamps a certificate on completion.
5. The dashboard subscribes to Postgres Realtime, so the progress ring, milestone drawer, and leaderboard update without the user refreshing.

**Architecture in one line.** React SPA → supabase-js → PostgREST + RLS + Edge Functions → Postgres 15. No custom Node server; the "backend" is Postgres itself, hardened with RLS policies and SECURITY DEFINER RPCs.

**Why that architecture.** For a two-sided platform with heavy read fan-out (leaderboards, listings, blog, gallery) and clear write paths (register, log activity, admin CRUD), letting PostgREST expose the tables and enforcing authorization at the row level was faster to ship and safer than hand-rolling controllers. Edge Functions are reserved for anything that needs a secret — Razorpay's HMAC verification, Strava token exchange, webhook handling.

**What I built in the frontend.** Router with lazy chunks and route-level skeletons in `App.tsx`, a global `AuthBootstrap` that hydrates Redux from Supabase and does targeted cache eviction on sign-out (preserves public caches like challenges/blog), route guards (`ProtectedRoute`, `UserRoute`, `AdminRoute`), the challenge and club detail pages with structured data for SEO, the entire admin CMS (challenges, milestones, clubs, blog, pages, testimonials, FAQs, coupons, gallery, notifications, newsletter, payment settings), and the realtime dashboard.

**What I built in the backend.** 74 SQL migrations covering 27 tables, RLS on every table, `has_role()` SECURITY DEFINER pattern to avoid RLS recursion, 15 Deno edge functions, 28 SQL routines including the progress/leaderboard/milestone/certificate pipeline, triggers for BIB assignment, certificate stamping, club owner seeding, and notification generation.

**Hardest problem I solved.** Realtime channel collision — the notification bell and the notifications page both instantiated `useUnreadCount`, and Supabase throws "cannot add postgres_changes callbacks after subscribe()" if two hooks share a channel name. I refactored the hook to use a per-instance UUID channel, so every subscriber gets its own channel object. That's the class of bug I love — one-line fix, but the root cause is about the identity semantics of a hook, not the surface error.

**What I'd change.** Move to a small dedicated Node/Fastify service in front of Postgres for the pieces PostgREST doesn't do well — request-scoped logging, complex transactions, and third-party fan-out — while keeping RLS as defense-in-depth. Introduce Playwright end-to-end tests for the payment and Strava flows. Add prerendering for public routes so social previews stop depending on Twitter's JS execution.

---

## Follow-up answers

**"What was your role?"**
Solo full-stack. I owned architecture, data model, frontend, edge functions, RLS, admin CMS, SEO, and deployment.

**"What features did you build?"**
Auth (email + Google), challenge browsing/registration/checkout, Razorpay payments with coupons, Strava OAuth + manual sync + webhook + cron, milestone engine, certificate generation, leaderboards (global and per-challenge), realtime dashboard, clubs with membership, blog + gallery + FAQ + testimonials + pages CMS, notifications (in-app bell + realtime), newsletter, and a full admin CMS with 15+ modules.

**"How does the frontend communicate with the backend?"**
Through a single `supabase-js` client. Reads go directly through PostgREST (auto-generated REST from the schema) protected by RLS. Writes that need secrets or complex flow — payments, Strava — go through Deno Edge Functions. Realtime updates come over a WebSocket subscribed to `postgres_changes` events.

**"How is state managed?"**
Three-tier: TanStack Query for server state (with `placeholderData: prev` for smooth transitions and targeted invalidation), Redux Toolkit for auth session + roles + UI state that many components consume, local `useState` for everything component-scoped. React Context is deliberately avoided for anything that would cause wide re-renders.

**"Why React?"**
Ecosystem maturity, TypeScript-first tooling, the shadcn/Radix component pattern that lets me own my components without giving up accessibility. Vite + SWC keeps HMR fast even as the codebase grew past 300 files.

**"Why TypeScript?"**
The Supabase-generated `Database` type gives me end-to-end typing from column to component. Zod schemas double as runtime validators for forms and API responses. Catches API-shape drift at build time.

**"Why this database?"**
Postgres is the right default for anything with relations, transactions, and clear domain boundaries — which this app has (users, challenges, registrations, activities, orders). RLS gave me row-level authorization without shipping an ORM + policy engine in userland.

**"Why this architecture?"**
Time-to-market and safety. RLS + PostgREST + Edge Functions means the surface area an attacker can hit is tiny — every read is filtered at the DB, every write with a secret goes through a signed function. Solo dev, small ops footprint.

**"What challenges did you face?"**
Realtime channel collisions; RLS recursion when policies referenced each other (solved with `has_role()` SECURITY DEFINER + fixed `search_path`); Strava's undocumented sport filtering; making the dashboard update instantly without polling; keeping SEO viable in an SPA (Helmet + JSON-LD + build-time sitemap generator).

**"What bugs did you fix?"**
The channel collision, milestone descriptions rendered as raw HTML (fixed with SafeHtml + DOMPurify), Strava's ingest_failed on Run-only challenges, dashboard recent activity showing 0.0 km due to a formatter rounding down, ClubDetail horizontal scroll on mobile, stale "Coming Soon" badge on Payment Settings.

**"What optimizations did you implement?"**
Route-level code splitting with per-route skeleton fallbacks, eager loading of hot routes to avoid Suspense flashes, `placeholderData: prev` in React Query, targeted cache eviction on sign-out (public caches survive), `dedupe` in Vite to prevent duplicate React copies, DB indexes on all hot lookup columns, realtime instead of polling.

**"What would you improve if you rebuilt it today?"**
1. Add a thin Node/Fastify BFF for observability, complex transactions, and easier third-party fan-out.
2. Prerender public routes at build time for real SSR-quality SEO.
3. Playwright suite for payment + Strava end-to-end flows.
4. Move rich-text/blog images through an image CDN with automatic AVIF/WebP.
5. Extract the milestone/progress engine into a testable pure module rather than living inside a trigger.
