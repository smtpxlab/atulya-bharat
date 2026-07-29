# Feature modules

Each subfolder owns one product domain. The Challenges vertical is the canonical
reference for how new features should be structured.

## Layering rule (non-negotiable)

```
Page  →  Feature hook (React Query)  →  Service  →  Supabase / Edge function
```

- **Pages / components** render UI and handle user interactions. They never
  call `supabase.*` directly and never contain business logic.
- **Feature hooks** (`features/<domain>/hooks/`) own React Query keys, caching,
  invalidation, and turn server data into domain types.
- **Services** (`src/services/`) are framework-agnostic async functions. They
  talk to Supabase / edge functions, normalize rows into domain types, and
  throw `ServiceError` on failure.
- **Schemas** (`src/schemas/`) hold the Zod validators shared between forms,
  hooks, and (future) edge-function callers.
- **Types** (`src/types/`) hold hand-written domain models. UI never imports
  generated Supabase row types.

## Reference: Challenges vertical

- Types: `src/types/challenge.ts`
- Schema: `src/schemas/challenge.schema.ts`, `src/schemas/registration.schema.ts`
- Service: `src/services/challenge.service.ts`, `src/services/registration.service.ts`
- Hooks: `src/features/challenges/hooks/{useChallenges,useChallengeDetail,useRegisterChallenge}.ts`
- Pages: `src/pages/Challenges.tsx`, `src/pages/ChallengeDetail.tsx`

Copy this pattern when migrating Dashboard, Clubs, Blog, Gallery, Admin, etc.
