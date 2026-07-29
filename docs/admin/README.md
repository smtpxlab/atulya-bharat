# Admin Backend & UI

Two-track architecture: a single API contract serves the admin UI today via a
Lovable Cloud edge function and tomorrow via a hosted Node.js/Express service.

```
Admin UI (src/features/admin)
    │
    ▼
adminApi (services/adminApi.ts)
    │   reads VITE_ADMIN_API_URL
    ▼
┌────────────────────────────┬─────────────────────────────┐
│  Edge function (today)     │  Node/Express (future)      │
│  supabase/functions/       │  backend/                   │
│    admin-api/index.ts      │    src/modules/admin/       │
└────────────────────────────┴─────────────────────────────┘
                              │
                              ▼
                       Lovable Cloud DB
```

## Folder ownership

| Concern | Location |
| --- | --- |
| Admin React pages | `src/features/admin/pages/*` |
| Admin services (HTTP) | `src/features/admin/services/*` |
| Admin React Query hooks | `src/features/admin/hooks/*` |
| Admin Zod schemas | `src/features/admin/schemas/*` |
| Admin layout/shell | `src/features/admin/layout/*` |
| Edge implementation | `supabase/functions/admin-api/index.ts` |
| Future Node implementation | `backend/src/modules/{admin,challenges,clubs,milestones}/*` |
| Shared validators (backend) | `backend/src/validators/admin.ts` |

## Rules

- Admin components MUST go through `adminApi`. No direct DB client imports under
  `src/features/admin/**`.
- The website (public pages) MAY continue to use `src/services/*` directly.
- Roles live in `public.user_roles`. The backend mirrors `is_admin()` semantics
  in `requireAdmin` middleware.
- Switching to the Node backend = set `VITE_ADMIN_API_URL`. No React code
  changes required.

## See also

- [API contracts](./api-contracts.md)
- [Auth flow](./auth-flow.md)
- [Roles](./roles.md)
- [Database gap analysis](./db-gap-analysis.md)
