# Roles

Roles live in `public.user_roles` (one row per `user_id` × `role`).

## `app_role` enum

| Role | Can call `/admin/*` | Notes |
| --- | --- | --- |
| `super_admin` | ✅ | Full access. |
| `admin` | ✅ | Full access. Equivalent to `super_admin` for current admin endpoints. |
| `user` | ❌ | Default role on signup. |

## Helper functions

- `public.is_admin(_user_id)` — true iff the user has `admin` or `super_admin`.
- `public.is_super_admin(_user_id)`
- `public.has_role(_user_id, _role)`
- `public.get_user_roles(_user_id)` — returns `app_role[]`.

All four are `SECURITY DEFINER` and used both in RLS policies and by the admin
backend.

## Frontend gating

`<AdminRoute>` only hides admin UI. The server (edge function or Node) is the
sole authority — every `/admin/*` request runs through `requireAdmin`.
