# Admin Auth Flow

```
┌─────────────┐    1. Sign-in        ┌─────────────────────┐
│  Admin UI   │ ───────────────────▶ │  Lovable Cloud Auth │
│             │ ◀─────────────────── │  (JWT + refresh)    │
└─────────────┘    2. JWT            └─────────────────────┘
       │
       │ 3. fetch /admin/* with Authorization: Bearer <jwt>
       ▼
┌────────────────────────────────────────────────────────────┐
│  Admin API (edge function today, Node tomorrow)            │
│                                                            │
│  ├─ verify JWT (JWKS / getClaims)                          │
│  ├─ load roles via public.get_user_roles(uid)              │
│  ├─ requireAdmin: roles ∩ {admin, super_admin} ≠ ∅         │
│  └─ run handler with service-role DB client                │
└────────────────────────────────────────────────────────────┘
       │
       ▼
   Lovable Cloud DB (RLS still enforced for non-admin clients)
```

## Token attachment (frontend)

`src/features/admin/services/adminApi.ts` reads the current session and adds
`Authorization: Bearer <access_token>` to every admin call. No role logic
runs on the client — the `AdminRoute` gate only hides UI; the server is the
authority.

## Verification (backend)

- **Edge function** uses `auth.getClaims(token)` to validate, then calls the
  `public.is_admin(_user_id)` RPC.
- **Node backend** uses `jose` + the project JWKS endpoint, then reads
  `public.user_roles` directly via the service-role client.

## Role mirroring

The backend treats `admin` and `super_admin` as administratively equivalent —
identical to `public.is_admin()` in the database. Any new admin-only role MUST
be added in **two** places: the SQL function and `backend/src/middleware/requireAdmin.ts`.
