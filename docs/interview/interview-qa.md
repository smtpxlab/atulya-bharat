# Interview Q&A Bank — Atulya Bharat Run

Each entry: **Q** • intent • best answer • common mistake • follow-up.
Answers are grounded in this codebase — cite files when speaking.

---

## React (50)

**1. What is the Virtual DOM and why does React use it?**
*Intent:* fundamentals. *Answer:* An in-memory tree of ReactElement objects. React diffs the new tree against the previous one and applies the minimal set of real DOM mutations, avoiding costly layout thrash. *Mistake:* saying "it makes React fast" — it's actually a trade-off; a hand-written DOM update is faster, VDOM is faster than naive re-render. *Follow-up:* how does Fiber change this?

**2. What is React Fiber?**
Reconciliation engine that splits render work into units and can pause/resume/prioritize them (concurrent rendering, Suspense, transitions). Enables `useDeferredValue`, `startTransition`. Old stack reconciler was synchronous and blocking.

**3. Difference between element, component, and instance?**
Element = plain object describing what to render. Component = function/class producing elements. Instance = component's runtime state (functional components have no instance; hooks close over a fiber slot).

**4. Functional vs class components — why did we pick functional?**
Hooks, less boilerplate, easier composition, better tree-shaking, official direction. Entire this codebase is functional.

**5. What triggers a re-render?**
State change in the component, parent re-render, context value change, `forceUpdate` (rare). Props change alone doesn't — the parent re-rendered, which recreated the element.

**6. `useState` vs `useReducer` — when?**
`useReducer` for state with multiple related transitions or when the next state depends on multiple actions. We use `useState` almost everywhere; forms use RHF's own store.

**7. `useEffect` cleanup — why?**
Prevent leaks (subscriptions, timers, WebSockets). In `useUserNotifications` we unsubscribe from the Supabase channel in cleanup — missing this was the bug that caused "cannot add postgres_changes after subscribe()".

**8. Difference between `useEffect` and `useLayoutEffect`?**
Layout runs synchronously after DOM mutation, before paint — use it to measure/adjust DOM. Effect runs asynchronously after paint. Overusing layout blocks paint.

**9. What does the dependency array do?**
Tells React whether to re-run the effect. Empty = once. Missing = every render. Wrong deps = stale closures.

**10. Explain stale closure bugs.**
An effect/callback captures state at the render it was defined in. If deps don't include the values it reads, it uses stale versions. Fix: include deps, or use `useRef` for values you don't want to trigger re-renders.

**11. `useMemo` vs `useCallback`?**
`useMemo` memoizes a computed value; `useCallback` memoizes a function reference (`useCallback(fn, deps)` ≡ `useMemo(() => fn, deps)`). Both are optimizations, not correctness tools.

**12. When does `React.memo` help?**
When the child is expensive and props are referentially stable. Wrapping every component wastes memory and adds comparison cost.

**13. Keys in lists — why?**
Stable identity across re-renders so React reuses DOM. Using index as key breaks reorder animations and can corrupt input state.

**14. Controlled vs uncontrolled inputs?**
Controlled: value in React state. Uncontrolled: DOM owns value, we read via ref. RHF uses uncontrolled + subscriptions — that's why it's fast for large forms.

**15. How does React Router v6 work here?**
`<BrowserRouter>` in `App.tsx`, nested routes under a layout `<Route element={<SiteLayout />}>`, `element={...}` per route, guards are wrapper components (`<AdminRoute>`).

**16. What is Suspense used for in this app?**
Wrapping lazy-loaded route chunks; the fallback is a route-specific skeleton so navigation feels instant.

**17. Why are Login/Home/Dashboard eager but ChallengeDetail lazy?**
Hot routes users hit constantly shouldn't flash a fallback; rarer/heavier routes benefit from code splitting.

**18. Explain your ErrorBoundary strategy.**
Global boundary around `<Routes>` + per-route boundaries for risky pages (Checkout, StravaCallback). Prevents a bad page from blanking the whole app.

**19. How does the auth session get into the tree?**
`AuthBootstrap` subscribes to `supabase.auth.onAuthStateChange` and dispatches to Redux; components read via `useAppSelector`.

**20. Why Redux + React Query together, not one or the other?**
Redux for cross-cutting client state (session, roles, UI toggles). Query for server state (caching, refetch, invalidation). Different problems; using Redux for server state means reinventing caching poorly.

**21. What is `placeholderData: prev`?**
Keeps the previous query data visible during refetches so lists don't flash empty during pagination/filter changes.

**22. How do you invalidate queries?**
`queryClient.invalidateQueries({ queryKey: qk.registrations.detail(id) })`. Keys are centralized in `src/lib/queryKeys.ts` to avoid typos.

**23. Explain targeted cache eviction on logout.**
`AuthBootstrap.isAuthScopedQuery` removes only queries whose key starts with `user`/`profile`/`dashboard`/... — public caches (challenges, blog) survive so the next visitor doesn't re-fetch everything.

**24. How does realtime work in the UI?**
Hooks subscribe to `supabase.channel(...).on('postgres_changes', ...)`. On event, we call `queryClient.invalidateQueries` on the affected key. UI re-renders from cache.

**25. Why did the notifications realtime crash?**
Two hook instances shared the same channel name; Supabase forbids adding a `postgres_changes` handler after `subscribe()`. Fixed by scoping the channel name with a UUID per hook instance.

**26. What's `useRef` for?**
Mutable value that persists across renders without re-rendering when it changes. Used in `AuthBootstrap` (`loadedForUserId`, `bootstrapStartedAt`).

**27. What's a custom hook?**
A function starting with `use` that composes other hooks. Encapsulates logic + provides typed return. Example: `useChallenges` wraps `useQuery` with a fixed key + service.

**28. Higher-order components vs hooks?**
HOCs wrap components; hooks compose logic without changing the tree. We prefer hooks — no wrapper hell.

**29. Composition patterns you use?**
`children` slots for layouts (`SiteLayout`, `AdminLayout`), compound components for shadcn primitives (Dialog.Root/Trigger/Content), render props are rare.

**30. Portals — do we use them?**
Yes — shadcn Dialog/Popover/DropdownMenu render into `document.body` via Radix portals.

**31. Concurrent features?**
`useDeferredValue` and `startTransition` not used yet; Suspense for lazy chunks is used.

**32. Hydration — applicable?**
No — this is a client-rendered SPA. First paint is empty; React mounts on load.

**33. Why not Next.js?**
Vite's DX and speed for a heavily interactive dashboard; Supabase RLS gives us safe direct-from-browser reads, weakening SSR's data-fetching advantage. Trade-off: SEO needs Helmet + JSON-LD + sitemap, and social preview scrapers can't run JS.

**34. Explain the `SEO` component.**
Wrapper around `react-helmet-async`. Sets title/meta/canonical/JSON-LD per route. Pulled from CMS (`challenges.meta_*`) or fallback derived from name/description.

**35. How is theming done?**
CSS variables in `src/index.css` under `:root` and `.dark`; Tailwind reads them via `hsl(var(--primary))`. No hard-coded colors in components.

**36. Accessibility measures?**
Radix under shadcn (roles, focus management), semantic HTML, alt text on `<img>`, ARIA on custom controls, keyboard-navigable menus.

**37. Bundle optimization?**
Route-level `React.lazy`, `vite` code-splitting per chunk, `dedupe` for React/Query, tree-shaken lucide icons via named imports.

**38. How do you prevent duplicate GoTrue client warnings?**
`src/lib/supabaseClient.ts` re-exports from `@/integrations/supabase/client.ts` — a single instance across the app.

**39. Explain `ScrollToTop`.**
Listens to `useLocation` and scrolls to top on `pathname` change. Otherwise nested pages inherit parent scroll.

**40. What is `RouteProgress`?**
Uses `nprogress` to show a top bar during route transitions — improves perceived perf.

**41. Testing setup?**
Vitest + Testing Library configured; coverage is minimal today. Interview-honest answer: I'd add Playwright for critical flows first.

**42. How do you handle forms?**
`useForm` from RHF with `zodResolver`. Schemas in `src/schemas/*`. Same schemas can validate on the server (edge functions) — single source of truth.

**43. Optimistic updates?**
Not currently used — dashboards refresh via realtime so optimism isn't needed. For manual activity log we invalidate on success.

**44. How do you show loading vs error?**
Route skeletons for chunk load; `isPending`/`error` from React Query drives inline skeletons/error states.

**45. Why not Context for auth?**
Context re-renders every consumer on value change. Redux with `useSelector` allows selective subscriptions — the bell doesn't re-render when the UI slice changes.

**46. What is `Suspense` fallback strategy here?**
Per-route custom skeletons matching final layout — reduces CLS and feels faster than a spinner.

**47. How do lazy chunks handle errors?**
The nearest `ErrorBoundary` catches chunk load errors; we render a "Something went wrong" with retry.

**48. Why `type: 'module'` in package.json?**
So Vite/tsx treat `.ts` scripts as ESM (needed for `scripts/generate-sitemap.ts`).

**49. Vite vs Webpack?**
Vite = native ESM in dev (near-instant HMR), Rollup for prod. Webpack bundles even in dev, slower cold start. Vite is a strict upgrade for our size.

**50. When would you use `useSyncExternalStore`?**
For subscribing to an external mutable store (e.g., localStorage listener, Redux without react-redux, media query matcher) with tearing-safe semantics.

---

## TypeScript (50)

**1. `interface` vs `type`?** Interfaces are declaration-mergeable and used for object shapes and class contracts; types can express unions, intersections, mapped types. Both are structurally typed. We use `interface` for domain models, `type` for unions and utilities.

**2. `any` vs `unknown`?** `any` disables checking; `unknown` requires narrowing before use. Prefer `unknown` at API boundaries.

**3. `never`?** The empty set. Return type of throwing/never-returning functions; exhaustiveness check with `const _: never = value`.

**4. Structural vs nominal typing?** TS is structural — shape matters, not name. Simulate nominal with branded types: `type BibNumber = string & { __brand: 'BibNumber' }`.

**5. Generics — where do we use them?** `ServiceError`, list-fetch helpers, react-query hooks (`useQuery<T>`). Zod's `z.infer<typeof schema>` is a generic.

**6. `keyof`, `typeof`, `in`?** `keyof T` = union of T's keys; `typeof x` = compile-time type of value x; `K in Keys` in mapped types iterates keys.

**7. Utility types?** `Partial`, `Required`, `Pick`, `Omit`, `Record`, `ReturnType`, `Awaited`. Used heavily in service ↔ form shape mapping.

**8. Discriminated unions?** `type Status = { kind: 'active'; km: number } | { kind: 'completed'; certificateId: string }` — narrow via `if (s.kind === 'active')`. Registration status uses this pattern.

**9. Enum vs union of literals?** Prefer unions — no runtime object, better tree-shaking. Enums used only for Postgres-generated enums.

**10. Strict mode flags?** `strict: true` enables strictNullChecks, noImplicitAny, etc. Non-negotiable.

**11. Type narrowing techniques?** `typeof`, `instanceof`, `in`, discriminant checks, user-defined type guards (`x is Foo`).

**12. Assertion functions?** `function assert(cond): asserts cond` narrows after call. Rare in this codebase.

**13. Conditional types?** `T extends U ? A : B`. Underpins `ReturnType`, `Awaited`.

**14. Mapped types?** `{ [K in keyof T]: ... }`. Used in Supabase's generated `Database` type.

**15. Template literal types?** `` `channel:${string}` `` — narrow strings. Not used heavily here.

**16. `readonly` vs `Readonly<T>`?** `readonly` per-field or on arrays; `Readonly<T>` maps all fields. Prevents accidental mutation of Redux state (RTK uses Immer under the hood).

**17. `satisfies` operator?** Ensures a value matches a type without widening — great for config objects where we want inference plus a shape check.

**18. Function overloads?** Multiple signatures + one implementation. Used sparingly; discriminated unions are usually clearer.

**19. Generic constraints?** `<T extends { id: string }>`. Enforces shape while keeping generic.

**20. Contravariance in function types?** Parameter types are contravariant, return types covariant. Comes up when overriding event handlers.

**21. Zod + TS?** `z.infer<typeof schema>` gives the TS type — schemas are the single source of truth for shape + validation.

**22. `tsconfig` paths?** `@/*` → `src/*` alias configured in both `tsconfig.json` and `vite.config.ts`.

**23. `Awaited<T>`?** Unwraps promise types recursively. Useful for `ReturnType<typeof asyncFn>` chains.

**24. Type of `useState`?** `Dispatch<SetStateAction<T>>`. `SetStateAction<T> = T | ((prev: T) => T)`.

**25. Typing custom hooks?** Explicit return type is best practice — prevents accidental widening when you refactor.

**26. Typing Supabase queries?** The generated `Database` type flows through `createClient<Database>` — `from('table').select()` returns the correct row type.

**27. Why not `any` at the Supabase boundary?** Types drift silently; runtime bugs. We use the generated types + Zod for anything user-input.

**28. Module augmentation?** `declare module 'x' { ... }`. Not used here.

**29. Ambient declarations?** `src/vite-env.d.ts` for Vite's ImportMeta env.

**30. `unknown[]` vs `any[]`?** Always `unknown[]` for external inputs; narrow before use.

**31. Class vs function type?** Functions typically enough; classes for stateful services with methods (not used here).

**32. Immutability with Redux Toolkit?** RTK uses Immer — you write "mutating" reducers, Immer produces immutable next state. Types stay `Readonly`.

**33. Typing async errors?** `catch (e: unknown)` (TS 4.4+), then narrow with `instanceof Error`.

**34. `ReturnType<typeof fn>`?** Pulls a function's return type for reuse without re-declaring.

**35. Distributive conditional types?** `T extends U ? X : Y` distributes over unions. Use `[T] extends [U]` to prevent distribution.

**36. `infer`?** Extract types inside conditional: `type ElementOf<T> = T extends (infer U)[] ? U : never`.

**37. Why declare env vars?** `interface ImportMetaEnv` in `vite-env.d.ts` so `import.meta.env.VITE_...` is typed.

**38. `Exclude`, `Extract`?** Set operations on union types — `Exclude<'a'|'b','a'> = 'b'`.

**39. `Pick` vs `Omit`?** Whitelist vs blacklist keys. Prefer `Pick` when the set of needed keys is small and stable.

**40. Global types?** Kept out of ambient scope. Domain types live under `src/types/`.

**41. Typing forwardRef?** `forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => …)`. shadcn components follow this.

**42. `NonNullable<T>`?** Excludes null/undefined. Handy after guards.

**43. Type-only imports?** `import type { Foo } from 'x'` — erased at compile time, no runtime side effect.

**44. `verbatimModuleSyntax`?** Newer TS flag enforcing type-only import syntax. Not currently enabled.

**45. Runtime vs compile-time types?** TS types erase; use Zod for runtime shape checks at boundaries.

**46. Typing event handlers?** `React.MouseEventHandler<HTMLButtonElement>`, `ChangeEvent<HTMLInputElement>`.

**47. `useReducer` typing?** `useReducer<Reducer<State, Action>>(reducer, initial)`; Actions are discriminated unions.

**48. Typing Redux Toolkit selectors?** `useAppSelector = useSelector.withTypes<RootState>()`.

**49. When does TS not help?** Runtime data from network/localStorage; always validate with Zod at ingest.

**50. Common TS anti-patterns?** `as` casting without narrowing, `any` in service returns, over-generic APIs, `Object`/`Function` types.

---

## Backend (50)

**1. What is the backend?** Lovable Cloud (managed Postgres + PostgREST + GoTrue + Storage + Realtime + Deno Edge Functions). No custom Node server.

**2. What does PostgREST do?** Auto-generates a REST API from the Postgres schema. Every table with GRANT + RLS becomes a queryable endpoint.

**3. Why RLS instead of controller-level auth?** Authorization at the row level, enforced by Postgres itself. Even if a client crafts a query, it can't read rows the policy forbids. Defense-in-depth against buggy business logic.

**4. Explain the `has_role` pattern.** Roles live in a separate `user_roles` table. `public.has_role(uid, role)` is SECURITY DEFINER with fixed `search_path`. RLS policies reference this function — using a plain sub-query instead would recurse via RLS.

**5. Why is `user_roles` a separate table?** Storing roles on `profiles` allows a user with UPDATE on their own row to escalate to admin. Separate table + strict RLS prevents that.

**6. When do we use edge functions vs direct PostgREST?** Anything needing a secret (Razorpay key, Strava tokens, SMTP creds), signature verification, or non-trivial fan-out. Simple CRUD stays on PostgREST.

**7. How is Razorpay verified?** `verify-razorpay-payment` computes HMAC-SHA256(`order_id|payment_id`, secret) and compares to `razorpay_signature`. Constant-time compare.

**8. Idempotency in payments?** `orders.status` transitions guarded; verify function checks current status before updating. Webhook is a safety net with same guard.

**9. Idempotency in Strava?** `activity_logs.strava_activity_id` unique index — UPSERT is a no-op if already imported.

**10. Cron?** pg_cron every 15 min calls `strava-cron-sync` for users whose webhook might have missed activities.

**11. Webhooks?** Strava POSTs to `strava-webhook`; subscription verified via `hub.challenge` GET on setup, and by matching `subscription_id` on POST.

**12. Rate limiting?** Not currently enforced beyond Supabase's built-in per-IP throttles on GoTrue. `contact-form` does an in-function check by IP.

**13. Logging?** `console.log` in edge functions → visible in Function Logs. Frontend uses `src/lib/monitoring` (init hook — pluggable for Sentry/PostHog).

**14. Transactions in Postgres?** Multi-statement writes go through a plpgsql function to run atomically.

**15. Migrations?** 74 SQL files in `supabase/migrations/`, timestamped, forward-only. Each new column/table/policy is a new migration.

**16. How do you avoid the "GRANT missing" trap?** Every `CREATE TABLE public.*` migration also has `GRANT ... TO authenticated` + `GRANT ALL ... TO service_role`, then RLS enable + policies.

**17. Storage buckets?** 10 buckets for challenge banners, club logos, blog images, gallery, certificates, milestone media, participation photos, profile avatars, route maps, rich-text uploads. Policies scope reads/writes.

**18. Auth flow?** Email+password (optionally Google) via GoTrue. Session in localStorage. Refresh token auto-rotated by supabase-js.

**19. Password hashing?** GoTrue (bcrypt) — managed.

**20. Email verification?** Handled by GoTrue templates; SMTP configured in Cloud settings.

**21. Forgot/reset password?** GoTrue magic-link → `/reset-password` route uses `supabase.auth.updateUser({ password })`.

**22. JWT structure?** `iss/aud/sub/exp/role/email/...`; access token 1h, refresh long-lived. Attached automatically to PostgREST/Edge calls.

**23. CORS?** Edge Functions set `Access-Control-Allow-*` headers explicitly per function.

**24. Input validation?** Zod schemas shared between client and edge functions.

**25. SQL injection risk?** PostgREST parameterizes; RPCs use plpgsql; no string concatenation in migrations.

**26. XSS mitigation?** All user rich-text sanitized with DOMPurify (`SafeHtml`) before render.

**27. CSRF?** Not applicable — no cookie-based auth; JWT in Authorization header.

**28. File upload flow?** Client uploads directly to Storage with signed URL / RLS check; row insert links the file URL.

**29. Realtime scaling?** Postgres logical replication → Realtime service fans out. Channels are per-topic (`user-notif-<uuid>` in our fix).

**30. Backup?** Managed by Cloud (point-in-time recovery). Manual CSV/JSON export available.

**31. Environment variables?** `.env` for public keys; secrets in Cloud secrets manager (never in repo).

**32. Secret rotation?** Rotate in Cloud, redeploy edge functions.

**33. Database indexes?** On FKs, `activity_logs.strava_activity_id` unique, slug uniques, `orders.status`, `registrations.challenge_id + user_id`.

**34. Denormalization?** `clubs.member_count`, `registrations.total_distance_km` maintained by triggers.

**35. Triggers vs application code?** Triggers guarantee invariants regardless of caller (edge fn vs client vs future job). Progress recalc lives in a trigger for that reason.

**36. When would triggers hurt?** Complex triggers become hidden state — hard to test and debug. Keep them narrow and single-purpose.

**37. Read replicas?** Not yet — single primary handles current load.

**38. Caching layer (Redis)?** Not currently. React Query is our client-side cache; PostgREST does no server caching. Would add Redis if leaderboard queries became hot enough.

**39. Background jobs?** pg_cron for scheduled. No queue system — flows are short and synchronous.

**40. Error handling in edge functions?** Return `{ error: { code, message } }` with proper HTTP status; client throws `ServiceError` mapped to toast.

**41. Retry semantics?** React Query retries once (default). Webhooks are idempotent so retry is safe.

**42. Ordering guarantees?** Realtime events are ordered per row; UI recomputes from cache after each event, so intermediate reorderings self-heal.

**43. Time zones?** All timestamps `TIMESTAMPTZ`, stored UTC. Client formats to user locale with `date-fns`.

**44. Soft delete?** No global convention; most tables have hard delete with FK cascade or restricted delete (e.g., `orders_block_delete`).

**45. Audit logs?** Not implemented as a first-class table; migration history + edge function logs used today.

**46. Multi-tenancy?** Single-tenant per project; RLS scopes per user, admin sees all via `has_role`.

**47. Search?** Postgres `ILIKE` + trigram indexes for now (blog, challenges). Would move to Postgres full-text search or Meilisearch at scale.

**48. Feature flags?** Not implemented; ad-hoc via env vars.

**49. Deno vs Node in edge functions?** Deno provides web-standard APIs (`fetch`, `crypto.subtle`, `Deno.env`) and per-request isolation. TS out of the box.

**50. Shared code between edge functions?** `supabase/functions/_shared/{razorpay,strava}.ts` — utilities imported by multiple functions.

---

## Database (30)

**1. Why Postgres?** ACID, rich types (`jsonb`, arrays, tstz), triggers, RLS, mature — perfect for a relational domain.

**2. Normalization level?** Mostly 3NF; targeted denormalization (`member_count`, `total_distance_km`) maintained by triggers.

**3. Explain the `registrations` ↔ `activity_logs` link.** `activity_logs.registration_id` FK. Trigger `activity_logs_sync_registration_total` aggregates on write.

**4. How does milestone unlock work?** Trigger checks `total_distance_km` against `challenge_milestones.threshold_km`; INSERTS into `user_milestones` per crossed threshold; a second trigger inserts a notification.

**5. How is certificate generated?** On registration transition to `completed`, `registrations_assign_certificate` stamps a UUID cert id. PDF/PNG rendered client-side via html2canvas.

**6. BIB number generation?** `registrations_assign_bib` trigger — sequential per challenge with prefix.

**7. Coupon validation?** `coupons.max_uses`, `expires_at`, `active` checked in edge fn before order creation.

**8. Leaderboard query?** `challenge_leaderboard(challenge_id, limit)` RPC — `SUM(distance) GROUP BY user ORDER BY sum DESC LIMIT`.

**9. Index on `activity_logs`?** `(registration_id, activity_date)` and `UNIQUE(strava_activity_id)`.

**10. Why unique on `strava_activity_id`?** Idempotency for webhook + cron + manual sync all trying to import the same activity.

**11. FK cascade rules?** `user_id → auth.users` ON DELETE CASCADE for user-owned rows; club deletion restricted while members exist.

**12. `auth.users` — can we touch it?** Read via joins only; never modify. GoTrue owns it.

**13. Postgres enums vs text?** Used for `role` (`app_role`) and `challenge_mode`. Enums enforce values; migrations to add values are cheap (`ALTER TYPE ADD VALUE`).

**14. Row estimate for hot tables?** `activity_logs` grows fastest — index-friendly, no scan on hot paths.

**15. Slow query strategy?** `EXPLAIN ANALYZE`, add index, denormalize if needed. `supabase--slow_queries` tool surfaces top offenders.

**16. Concurrency on `orders.booking_number`?** Sequence-backed via trigger; safe under concurrent inserts.

**17. Preventing negative distance?** `guard_non_negative_distance` trigger.

**18. Preventing status regression?** `guard_registration_status_transition` enforces FSM.

**19. Public vs auth-only reads?** Public tables (`challenges`, `blog_posts`, `clubs`) grant SELECT to `anon`; user tables scope by `auth.uid()`.

**20. Backup and restore?** Cloud PITR; manual pg_dump not available on managed plan — CSV export tool for user-triggered backups.

**21. Materialized views?** Not used; leaderboard is fast enough as a live query.

**22. Partitioning?** Not needed at current scale; would partition `activity_logs` by month first.

**23. `jsonb` usage?** `challenges.metadata`, milestone `media`, page `content`. Indexed with GIN when queried.

**24. Race condition in registration count?** Handled by trigger + transactional insert; `clubs.member_count` recomputed via aggregate.

**25. How to add a new admin?** Insert into `user_roles(user_id, 'admin')` via secure SQL (admin-only). Scripted in `scripts/seed-admin.ts`.

**26. Schema migrations rollback?** Forward-only; write a compensating migration if needed. Never edit historical migrations.

**27. Foreign key vs application check?** FKs whenever possible — cheapest, most reliable invariant.

**28. Store money as?** Integer paise (`amount_paise`) to avoid float rounding.

**29. Time-based queries?** `activity_date BETWEEN` with index on `activity_date`.

**30. Deleting a user?** Cascade to profile, registrations, tokens, notifications, club memberships. Certificates preserved via nullable owner.

---

## System Design (30)

**1. How would you scale reads?** Add Postgres read replica for PostgREST; front hot public endpoints with a CDN + edge cache.

**2. Scale realtime?** Realtime service is already horizontally scaled by Supabase; per-topic channels distribute load.

**3. Handle a viral challenge (100k signups in a day)?** Queue registration writes; move payment verification to a worker; pre-warm leaderboard cache.

**4. Prevent double-payment?** Idempotency key (`orders.id`), status guard, verify + webhook both check.

**5. Prevent duplicate Strava imports?** Unique index on `strava_activity_id`.

**6. How would you add real-world event support (physical race timing)?** New `chip_timing` table with FKs to `registrations`; ingest via CSV or gun-timing API into `activity_logs` with source=`chip`.

**7. Search at scale?** Migrate to Postgres FTS with `tsvector` GIN index; move to Meilisearch/OpenSearch if fuzzy + typo tolerance needed.

**8. Image delivery?** Currently Supabase Storage direct; add Cloudflare Images / imgproxy for on-the-fly resize + AVIF.

**9. SEO with SPA?** Helmet per route + build-time sitemap + JSON-LD. Long-term: prerender public routes with a static export step.

**10. Multi-region latency?** Read replicas near users; write region stays close to payment providers.

**11. Notification fan-out?** In-app via triggers; email/SMS/push via edge function triggered by DB event.

**12. Rate-limit signup abuse?** Cloudflare Turnstile on signup, per-IP throttle in edge fn.

**13. Design the leaderboard.** Query `activity_logs` grouped by user; index on `(challenge_id, user_id)`. Cache result in Redis with 60s TTL if it becomes hot.

**14. Design the certificate service.** Client renders via `html2canvas`; server-side option: HTML → PDF via headless Chrome edge fn, store in Storage, return signed URL.

**15. Design offline logging.** IndexedDB queue → sync on reconnect through the manual log endpoint (idempotent by client UUID).

**16. Feature flags?** `feature_flags` table + edge fn returning enabled set per user; React Query cached.

**17. A/B testing?** Assign variant on signup, persist in `profiles.experiment_bucket`; log conversion events.

**18. Analytics?** PostHog or Plausible — SPA route change → capture; server events via edge fn.

**19. GDPR delete?** Cascade delete from `auth.users`; certificate anonymized (owner set null, name kept if issued).

**20. Zero-downtime migration for a column rename?** Add new col → dual-write → backfill → switch reads → drop old col — across 4 deploys.

**21. Payment provider outage?** Fall back to secondary gateway configured in `payment_gateways`; keep failed orders in `created` for retry.

**22. Strava outage?** Cron still tries; users can log manually. Webhook queue on their side eventually replays.

**23. How would you design a mobile app on the same backend?** Same supabase-js in React Native/Expo; reuse RLS + edge functions; deep-link OAuth callbacks.

**24. CDN caching public pages?** Cache-Control on public GET responses; purge on admin edits via webhook.

**25. Observability stack?** Sentry (frontend errors), edge function logs, Postgres slow-query log, Uptime Kuma for endpoints.

**26. Disaster recovery drill?** Weekly restore of a snapshot into a staging project; smoke test critical flows.

**27. Sharding?** Not needed at foreseeable scale. If forced: shard by `challenge_id` because activities cluster there.

**28. Real-time leaderboard?** Materialized view refreshed on `activity_logs` change; broadcast via Realtime.

**29. Ensuring RLS never gets bypassed?** Never expose service role key to client; audit each edge fn for correct role selection; run `supabase--linter` regularly.

**30. Multi-language content?** `translations` table keyed by (entity_type, entity_id, locale); Helmet + hreflang tags.

---

## Project-Specific (30)

**1. Walk through what happens when a user pays for a challenge.** Checkout page → `create-razorpay-order` (inserts `orders`, calls Razorpay) → Razorpay Checkout modal → `verify-razorpay-payment` (HMAC verify, update `orders.paid`, insert `registrations` triggering BIB assignment) → redirect to registration detail.

**2. What happens when a Strava activity is uploaded?** Strava POSTs `strava-webhook` → we fetch activity detail → filter sport → UPSERT `activity_logs` → trigger recomputes `registrations.total_distance_km` → milestone/completion triggers → notifications inserted → Realtime pushes to open dashboards → React Query invalidates.

**3. How does the dashboard update without polling?** `useRegistrationRealtime` subscribes to `postgres_changes` on `activity_logs`, `registrations`, `user_milestones` scoped to the user; invalidates React Query keys on event.

**4. Why did the "postgres_changes after subscribe" error occur?** Two `useUnreadCount` instances (bell + notifications page) shared a channel name; Supabase rejects adding handlers post-subscribe. Fixed with per-instance UUID.

**5. Why was milestone description rendered as raw HTML?** We rendered `description` as text. Changed to `SafeHtml` component that runs DOMPurify → renders as HTML.

**6. Why were Strava activities failing with `ingest_failed`?** Missing `_activity_type_matches_mode` function for new sports. Migration added it; runs correctly filter.

**7. How is a certificate generated?** Trigger stamps `certificate_id` on completion; `CertificateSection` renders template with user data; `html2canvas` produces PNG for download/share.

**8. Explain the coupon flow.** Coupon table with `code`, `discount_type` (percent/flat), `max_uses`, `expires_at`. `create-razorpay-order` validates + applies discount server-side, records `coupon_id` on order.

**9. How do admin routes stay secure?** `AdminRoute` checks Redux role state → redirects if not admin. Real enforcement is RLS + `has_role()` — even if someone bypasses the UI, DB rejects.

**10. What is `AuthBootstrap`?** Single component mounted near root, subscribes to `onAuthStateChange`, hydrates Redux, fetches roles, times "time-to-initialized" for monitoring, and runs targeted cache eviction on sign-out.

**11. Why targeted cache eviction?** Public data (challenges, blog) is safe post-logout; wiping it caused unnecessary refetches for the next visitor. `isAuthScopedQuery` predicate keeps public caches.

**12. Why lazy-load some routes and eager-load others?** Hot routes users hit constantly (Home, Login, Dashboard) would flash a Suspense fallback on every nav; rare heavy pages (ChallengeDetail, Checkout) benefit from a smaller initial bundle.

**13. How does SEO work in this SPA?** `SEO` component via `react-helmet-async` sets title/meta/canonical/JSON-LD per route; sitemap generated at build time by `scripts/generate-sitemap.ts`; structured data (`SportsEvent`, `SportsClub`, `WebSite`, `BreadcrumbList`) for rich results.

**14. What's stored in Redux vs React Query?** Redux: session, roles, UI toggles. React Query: everything from the server.

**15. Explain the notification bell.** `useUnreadCount` (per-instance channel) → Realtime subscription on `user_notifications` filtered by `user_id`. Bell renders count; click opens `/notifications`.

**16. Why is `supabase/config.toml` singular?** Lovable Cloud allows one config; project-level settings are managed via the platform.

**17. How does the Strava cron know it's Strava calling?** It doesn't — pg_cron calls it with a CRON_SECRET header verified by the function.

**18. Explain the routing guards.** `ProtectedRoute` = signed in. `UserRoute` = signed in + not admin (or as configured). `AdminRoute` = `has_role('admin')`.

**19. How is club membership enforced?** `club_members` table with FK to `clubs` and `profiles`. `clubs_seed_owner_member` trigger on club create; `club_members_block_last_owner_delete` prevents orphaning.

**20. What's the deployment story?** Hosted on Lovable; preview + published URLs + custom domain. Edge functions and migrations deploy alongside code. `predev`/`prebuild` regenerate the sitemap.

**21. How do you monitor?** `monitoring.init()` in `main.tsx` (pluggable to Sentry/PostHog); Cloud provides edge function logs.

**22. Why was "Coming Soon" showing on Payment Settings?** Stale `comingSoon: true` flag in `AdminSidebar.tsx` — removed once routes were live.

**23. What is the biggest tech debt?** ~8 pages still call `supabase.*` directly instead of going through the service/hook layering; documented in `docs/audit/`.

**24. What if you moved to a Node backend?** Add a Fastify BFF for request-scoped logging, complex transactions, third-party fan-out. Keep RLS as defense-in-depth. See `docs/audit/14-node-backend-readiness.md`.

**25. How would you test the payment flow?** Playwright + Razorpay's test mode; assert `orders.status=paid` and a `registrations` row exists.

**26. How is the sitemap regenerated?** `scripts/generate-sitemap.ts` queries public tables and writes `public/sitemap.xml`. Runs on `predev` and `prebuild`.

**27. How are images uploaded from the rich-text editor?** `richTextImage.service.ts` uploads to a storage bucket via signed URL; returns public URL inserted into TipTap.

**28. How is participation photo generated?** `ParticipationShareCard` composes user photo + challenge branding via canvas; downloaded/shared.

**29. What's the responsive strategy?** Tailwind breakpoints (`sm`/`md`/`lg`), mobile-first defaults; audited page-by-page (`RESPONSIVE_AUDIT.md`).

**30. Why is the app fully portable to a stock Supabase project?** Nothing in `src/` or `supabase/` uses Lovable-only APIs — everything is standard PostgREST + Supabase JS + Deno Edge Functions. Moving is a matter of pointing env vars at a self-hosted project and re-uploading storage.
