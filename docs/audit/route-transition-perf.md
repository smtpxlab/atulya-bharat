# Route Transition Perf — Baseline & Targets

Date: 2026-06-19

## Targets

| Metric | Target |
|---|---|
| Route transition (paint) | < 300 ms |
| API response (p95) | < 500 ms |
| LCP | < 2.5 s |
| CLS | < 0.1 |
| Initial JS per route | < 250 KB gzipped |

## Loading strategy

| Window | Behavior |
|---|---|
| 0–300 ms | Keep current content; nprogress bar trickles |
| 300–1000 ms | Route-specific skeleton mounts |
| 1000+ ms | nprogress reaches near-completion; skeleton visible |

## Shipped in this pass

- Top progress bar (`nprogress`) mounted globally via `<RouteProgress/>`.
- Route-level skeletons replacing all `fallback={null}`:
  `PageShellSkeleton`, `CheckoutSkeleton`, `ChallengeDetailSkeleton`,
  `BlogPostSkeleton`, `ClubDetailSkeleton`, `FormPageSkeleton`,
  `AdminContentSkeleton`.
- React Query defaults: `staleTime 5 min`, `gcTime 30 min`,
  `placeholderData: (prev) => prev` (keepPreviousData v5).
- `usePrefetchOnHover` hook wired into `ChallengeCard` & `ClubCard` —
  detail data is fetched on intent (hover/focus/touchstart).

## Out of scope (future)

- Bundle visualizer in CI
- Storage image transforms (?width=…&format=webp)
- View Transitions API / route animation
- SSR / pre-render
