# Security Hardening — 2026-06-19

Closes the Critical findings from the latest Supabase security scan.

## Resolved

| # | Finding | Fix |
|---|---|---|
| 1 | `profiles` PII publicly readable | Dropped `Profiles viewable by everyone USING (true)`. New SELECT policy: self, admin, or fellow club member only. Anon SELECT grant revoked. |
| 2 | `clubs` promoter PII publicly readable | Removed the `Public approved clubs viewable` policy. Public reads go through new SECURITY DEFINER RPCs `list_public_clubs()` and `get_public_club_by_slug(slug)` which omit `promoter_email`, `promoter_phone`, `promoter_address`, `promoter_dob`. Owners/admins still see full row through base table. |
| 3 | Realtime channels unscoped | Audited the realtime publication (`registrations`, `activity_logs`, `user_milestones`). Each table already has `auth.uid() = user_id` SELECT policies, so realtime filters per row. The only client subscription (`Dashboard.tsx`) further filters by `user_id=eq.${userId}`. No change required. |
| 4 | Coupons enumerable | New SECURITY DEFINER RPC `validate_coupon(_code, _subtotal)` returns only `{valid, discount, coupon_name, coupon_type}` or a reason code. `CouponPanel.tsx` rewritten to call the RPC; no client can read the `coupons` table. |
| 5 | SECURITY DEFINER execute grants | Revoked EXECUTE from `public`/`anon`/`authenticated` on internal helpers (`is_admin`, `is_super_admin`, `has_role`, `is_club_member`, `get_user_roles`, `handle_new_user`, `bump_club_member_count`, `clubs_enforce_pending_for_users`, `update_updated_at_column`). Explicit GRANTs for the four intentional public RPCs (`global_leaderboard`, `hall_of_fame`, `challenge_leaderboard`, `subscribe_to_newsletter`) plus the two new club RPCs and `validate_coupon`. |
| 6 | Public bucket listing | Dropped `storage.objects` SELECT policies that allowed enumeration of `blog-images`, `gallery`, `challenge-assets`, `challenge-covers`, `milestone-audio`, `milestone-images`, `club-logos`, `club-banners`. Public buckets continue serving files via CDN (`getPublicUrl`) because `bucket.public = true`. |
| 7 | Contact / newsletter abuse | Already scoped: `contact_enquiries` allows anon INSERT only; admin-only SELECT/manage. `newsletter_subscribers` is admin-only; inserts go through `subscribe_to_newsletter` RPC. (Captcha / IP rate-limit live at the edge-function layer — tracked separately.) |
| 8 | "Always true" policies | Replaced/scoped: `testimonials`, `gallery_images` policies now target `anon, authenticated` explicitly. `milestone_media` requires the parent milestone to be enabled. `club_social_links` requires the club to be approved + public. `challenge_tickets` requires the parent challenge to be enabled. `coupons` and `strava_tokens` admin policies re-scoped to `TO authenticated`. |

## Remaining linter warnings (accepted)

- `RLS Policy Always True` — `contact_enquiries "Anyone can submit enquiries"` INSERT WITH CHECK (true): intentional, allows public form submissions.
- `Public/Signed-In Can Execute SECURITY DEFINER Function` — the seven RPCs listed above are intentional public/auth APIs.

## Frontend changes

- `src/services/club.service.ts` — `listClubs`, `getClubBySlug` call the new RPCs.
- `src/services/profile.service.ts` — `DashboardClubRow` and `getCreatedClubs`/`getJoinedClubs` no longer carry promoter email/phone.
- `src/components/dashboard/DashboardClubsSections.tsx` — drops the promoter email line.
- `src/components/checkout/CouponPanel.tsx` — switched to `validate_coupon` RPC; `AppliedCoupon` simplified.
- `src/pages/CheckoutPage.tsx` — uses `coupon.coupon_name` directly.
- `src/types/club.ts` — promoter PII fields marked optional.

## Verification

1. Anon REST against `profiles` / `clubs` returns no rows.
2. Anon RPC `list_public_clubs` returns approved, public clubs without PII columns.
3. Authenticated non-admin can read own profile + profiles of users sharing a club.
4. `supabase.rpc("validate_coupon", { _code, _subtotal })` returns sanitized JSON; direct `from("coupons")` reads remain blocked for non-admins.
5. Dashboard realtime channel only receives the signed-in user's own rows.
6. `supabase.storage.from("gallery").list()` throws for anon while `getPublicUrl()` still serves images.

## 2026-06-19 follow-up — RBAC helper EXECUTE grants

Item #5 above over-revoked `EXECUTE` on the RBAC helpers from `authenticated` as well as `anon`/`public`. Because every admin-related RLS policy on `user_roles`, `profiles`, `clubs`, `challenges`, and `blog_posts` evaluates `is_admin(auth.uid())` in its `qual`, and `SECURITY DEFINER` does not give the *caller* the right to invoke the function, signed-in users hit `42501 permission denied for function is_admin` and the whole query failed. Symptoms: admin redirected to `/dashboard`, public challenges/blogs hidden once signed in, console errors from `listMyClubMemberships` and `listPublishedBlogs`.

Restored grants (forward-only migration):

```sql
GRANT EXECUTE ON FUNCTION public.is_admin(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid)       TO authenticated;
```

`anon` remains revoked — every policy that calls these helpers is `TO authenticated`, and anonymous read paths use plain column predicates (`status = true`, `is_published = true`, `is_public = true`). Trigger-only helpers (`handle_new_user`, `bump_club_member_count`, `clubs_enforce_pending_for_users`, `update_updated_at_column`) stay revoked.

The five resulting "Signed-In Users Can Execute SECURITY DEFINER Function" linter warnings are **accepted** — they match the original audit recommendation in `docs/audit/06-rbac-security.md` finding S3.
