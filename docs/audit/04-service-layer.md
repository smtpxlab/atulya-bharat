# 04 — Service Layer Audit

All services live in `src/services/` and return domain types (`src/types/`). Every service catches `PostgrestError` / `FunctionsHttpError` via `toServiceError()` (`src/services/errors.ts`) and throws a normalized `ServiceError`.

## Service inventory

| Service | Methods | Validation | Consumers |
|---|---|---|---|
| `challenge.service.ts` | `listChallenges`, `getChallengeDetails(slug)` | None at boundary (returns rows mapped via `fromRow`) | `useChallenges`, `useChallengeDetail` |
| `registration.service.ts` | `registerForChallenge(args)` | `RegistrationInputSchema` (Zod) | `useRegisterChallenge`, `RegistrationModal` |
| `payment.service.ts` | `createRazorpayOrder`, `verifyRazorpayPayment` | None | `registration.service` |
| `club.service.ts` | `listClubs`, `getClubBySlug`, `joinClub`, `leaveClub` | None | **None** (Clubs pages still call Supabase directly) |
| `profile.service.ts` | `getProfile`, `updateProfile` | `ProfileUpdateSchema` | **None** in pages yet |
| `blog.service.ts` | `listPosts`, `getPostBySlug`, `listTags` | None | **None** in pages yet |
| `gallery.service.ts` | `listGalleryImages(challengeId?)` | None | **None** in pages yet |
| `strava.service.ts` | `stravaConnect(code)`, `stravaSyncManual()` | None | **None** in pages yet |
| `contact.service.ts` | `submitEnquiry(input)` | `ContactEnquirySchema` | **None** in pages yet |
| `errors.ts` | `ServiceError`, `toServiceError(err, op)` | n/a | All services |

## Migration matrix

| Feature | Direct Supabase in page? | Service exists? | Feature hook? | Status |
|---|---:|---:|---:|---|
| Challenges list | No | Yes | Yes | **Done** |
| Challenge detail | No | Yes | Yes | **Done** |
| Registration | No (via mutation) | Yes | Yes | **Done** |
| Dashboard (profile, activity logs, milestones, strava) | **Yes** (10+ calls) | Partial (`profile`, `strava` only) | No | **Not started** |
| Clubs list | **Yes** | Yes | No | **Service ready, page not migrated** |
| Club detail | **Yes** | Partial | No | **Service ready, page not migrated** |
| Create club (storage upload) | **Yes** | No (no `createClub`/storage method) | No | **Service gap** |
| Blog list / detail | **Yes** | Yes | No | **Service ready, page not migrated** |
| Gallery | **Yes** | Yes | No | **Service ready, page not migrated** |
| Leaderboard | **Yes** (RPC) | No | No | **Service gap** |
| Hall of Fame (home) | **Yes** (RPC) | No | No | **Service gap** |
| Contact | **Yes** | Yes | No | **Service ready, page not migrated** |
| Strava callback | **Yes** (`functions.invoke`) | Yes (`stravaConnect`) | No | **Service ready, page not migrated** |
| Auth (login/signup/signout) | **Yes** in pages + `useAuth` | No (intentional — Supabase Auth lives in context) | n/a | **Acceptable** |
| Admin | n/a | No | No | **Not built** |

## Service-layer gaps to add before Node.js backend

| Gap | Where used | Suggested service |
|---|---|---|
| Leaderboard RPCs (`global_leaderboard`, `challenge_leaderboard`, `hall_of_fame`) | `Leaderboard.tsx`, `HallOfFameSection.tsx`, `ChallengeDetail` | `leaderboard.service.ts` |
| Activity log create + milestone unlock | `Dashboard.tsx` | `activity.service.ts` (should call a future DB function for atomicity) |
| Club creation + logo upload | `CreateClub.tsx` | extend `club.service.ts` with `createClub`, `uploadClubLogo` |
| Storage signed URLs for private buckets | `BlogPost`, `Gallery`, `MilestoneLibraryDrawer` | `storage.service.ts` |
| User registrations list | `Dashboard.tsx` | extend `registration.service.ts` with `listMyRegistrations(userId)` |
| User milestones list | `Dashboard.tsx` | new `milestone.service.ts` |

## Error handling

`ServiceError` shape (`src/services/errors.ts`):

```ts
class ServiceError extends Error {
  code: string;       // PostgREST code, function status, or "unknown"
  status?: number;
  operation: string;  // service method name
  cause?: unknown;
}
```

Every service wraps its body in `try { ... } catch (e) { throw toServiceError(e, "opName") }`. Consumers (React Query) get a typed error.

`ErrorBoundary.componentDidCatch` forwards to `monitoring.captureError`. React Query errors do **not** currently route through `monitoring` — there is no global `QueryClient` `onError` handler. Add one when wiring Sentry.

## Recommendations

1. Add the 6 missing service methods listed above before starting Node.js work — keeps the API surface stable.
2. Wire a global `QueryCache` / `MutationCache` error handler that calls `monitoring.captureError`.
3. Adopt Zod parsing at the **service boundary** (currently only inputs are validated; outputs trust DB shape).
