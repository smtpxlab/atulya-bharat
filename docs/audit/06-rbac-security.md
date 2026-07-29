# 06 — RBAC & Security Audit

## Roles

`public.app_role` enum: `admin`, `user`, `club_owner`, `content_manager`, `super_admin`.

| Role | Assignment | Used in code? |
|---|---|---|
| `user` | Auto-assigned on signup by `handle_new_user()` | Default for all sessions |
| `admin` | Manually inserted (seed script `scripts/seed-admin.ts`) | `AdminRoute`, RLS policies (`is_admin`), storage policies |
| `super_admin` | Manual | `useAuth.isSuperAdmin`, RLS via `is_admin()` shortcut |
| `club_owner` | **Not yet assigned anywhere** (added to enum 2026-06-15) | Reserved for future club-promoter flow |
| `content_manager` | **Not yet assigned anywhere** | Reserved for future CMS scope |

Roles are stored in `public.user_roles(user_id, role)` with `UNIQUE(user_id, role)` — correct pattern; no role columns on `profiles`.

## Auth helpers

| Function | Purpose | Status |
|---|---|---|
| `has_role(_user_id, _role)` | RLS predicate | SECURITY DEFINER, search_path=public ✓ |
| `is_admin(_user_id)` | shortcut for admin or super_admin | ✓ |
| `is_super_admin(_user_id)` | super_admin only | ✓ |
| `get_user_roles(_user_id)` | returns `app_role[]` | ✓ |

All four are `STABLE SECURITY DEFINER` with explicit `search_path = public` — secure pattern.

## Route guards

| Guard | File | Behavior |
|---|---|---|
| `ProtectedRoute` | `src/components/auth/ProtectedRoute.tsx` | Redirect to `/login` if no `user` |
| `AdminRoute` | `src/components/auth/AdminRoute.tsx` | Redirect + toast if not `isAdmin` |
| `RoleRoute` | `src/components/auth/RoleRoute.tsx` | Generic single-role guard |

| Route | Guard |
|---|---|
| `/dashboard` | `ProtectedRoute` |
| `/auth/strava/callback` | `ProtectedRoute` |
| `/clubs/create` | `ProtectedRoute` |
| `/admin` | `AdminRoute` |
| All other routes | Public |

Note: route guards are UI-only — every privileged action is also gated by RLS at the DB layer (defense in depth). ✓

## Edge function auth

| Function | `verify_jwt` | In-code check | Service-role used? |
|---|---|---|---|
| `create-razorpay-order` | true (default) | `getClaims(jwt)` ✓ | No |
| `verify-razorpay-payment` | true (default) | **Not reviewed** | Likely yes (`Needs verification`) |
| `strava-config` | **false** | None — returns only public client_id ✓ | No |
| `strava-connect` | true (default) | `getUser()` ✓ | Yes (upsert into `strava_tokens`) |
| `strava-sync-manual` | true (default) | (`Needs verification` — file truncated in audit) | Yes |
| `strava-webhook` | **false** | Strava `verify_token` / HMAC check: `Needs verification` | Yes |
| `strava-webhook-setup` | true (default — assumed) | Admin-only intended | Yes |

## RLS matrix (public schema)

Legend: `pub` = anyone (anon + authed) via PostgREST; `owner` = `auth.uid() = user_id` predicate; `admin` = `is_admin(auth.uid())`; `—` = no policy of that command.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `activity_logs` | owner | owner | owner *(no WITH CHECK)* | owner |
| `activity_logs` (admin override) | admin (ALL) | admin | admin | admin |
| `blog_posts` | pub (`is_published=true`) + admin | admin | admin | admin |
| `challenge_tickets` | pub (`true`) | admin | admin | admin |
| `challenges` | pub (`is_active=true`) + admin (all) | admin | admin | admin |
| `club_members` | pub (member of public club) + member-of-same-club + owner | owner | — | owner |
| `club_members` (admin) | admin | admin | admin | admin |
| `clubs` | pub (`is_public=true`) + private if member | owner (`auth.uid()=promoter_id`) | admin only | admin only |
| `contact_enquiries` | admin only (not enumerated above — see migration 5) | pub (form submit) | admin | admin |
| `gallery_images` | pub | admin | admin | admin |
| `milestone_media` | pub | admin | admin | admin |
| `milestones` | pub | admin | admin | admin |
| `orders` | owner | service-role (edge fn) | service-role | admin |
| `profiles` | pub | trigger (`handle_new_user`) | owner | — |
| `registrations` | owner | owner (post-payment via edge fn) | owner / admin | admin |
| `strava_tokens` | owner | owner | owner | owner |
| `testimonials` | pub (`is_active=true`) | admin | admin | admin |
| `user_milestones` | owner | owner | owner | admin |
| `user_roles` | owner (read own) | admin only | admin only | admin only |

## Storage policies (bucket-level)

| Bucket | Public read | Authenticated upload | Admin write | Owner delete |
|---|---|---|---|---|
| `club-logos` (public bucket) | yes (public read policy + bucket flag) | yes | — | yes (owner = `auth.uid()`) |
| `blog-images` | yes (policy) | — | yes (`has_role(admin)`) | — |
| `challenge-covers` | yes | — | yes | — |
| `gallery` | yes | — | yes | — |
| `milestone-images` | yes | — | yes | — |
| `milestone-audio` | yes | — | yes | — |

All "private" buckets actually allow public read via a `bucket_id = '...'` policy with no auth predicate. This is intentional for image/audio delivery (acts like a CDN), but means anyone with a URL can read — **no signed URLs are used anywhere in the codebase**. Acceptable today; revisit if any content becomes paid/gated.

## Supabase linter findings

| # | Level | Issue | Action |
|---|---|---|---|
| L1 | WARN | RLS policy `USING (true)` on `challenge_tickets` SELECT — INTENTIONAL public catalogue | Accept |
| L2–L11 | WARN | Public can execute SECURITY DEFINER: `is_admin`, `is_super_admin`, `has_role`, `get_user_roles`, `bump_club_member_count`, `handle_new_user`, `hall_of_fame`, `global_leaderboard`, `challenge_leaderboard` | **Restrict** `is_admin`, `is_super_admin`, `has_role`, `get_user_roles` to `authenticated`. Triggers (`bump_club_member_count`, `handle_new_user`) need EXECUTE on the trigger owner only — likely false positive. Leaderboard / hall-of-fame are intentional public reads. |
| L12+ | (8 more issues, content truncated in audit) | `Needs verification` | Run `supabase linter` and triage |

## Risks & recommendations

| # | Risk | Recommendation |
|---|---|---|
| S1 | `activity_logs UPDATE` policy has `with_check IS NULL` — owner can flip `user_id` on update to another user. | Add `WITH CHECK (auth.uid() = user_id)`. |
| S2 | `club_members INSERT` allows any authed user to insert with `auth.uid() = user_id` for any `club_id` regardless of `is_public`. Could spam private clubs. | Add EXISTS check that `clubs.is_public = true` OR user has an invite. |
| S3 | `is_admin()` callable by anon enables enumeration of which user UUIDs are admin. | Revoke EXECUTE from `anon` / `public`, grant to `authenticated`. |
| S4 | No rate limiting on `contact_enquiries` INSERT (open to spam). | Add Cloudflare turnstile / hCaptcha on `Contact.tsx` and a `created_at` rate-limit policy. |
| S5 | No CORS allowlist on edge functions (uses `*`). Fine for public client; tighten to known origins for `verify-razorpay-payment`. | Optional hardening. |
| S6 | `strava-webhook` is `verify_jwt = false` — Strava signature/verify-token check not confirmed in this audit. | Verify and document. |
