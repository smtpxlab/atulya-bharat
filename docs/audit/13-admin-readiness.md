# 13 — Admin Readiness Audit

`/admin` route currently renders only `src/pages/Admin.tsx` (placeholder). RBAC guard `AdminRoute` is in place. RLS policies already permit `is_admin(auth.uid())` to read/write every domain table.

## Per-module readiness

Legend: ✓ ready, ◐ partial, ✗ not present.

| Module | DB table(s) | RLS (admin write) | Service method(s) | Admin UI | Notes |
|---|---|---|---|---|---|
| Dashboard (KPIs) | aggregates of `registrations`, `activity_logs`, `orders` | ✓ via admin policies | ✗ | ✗ | Need an `admin.service.ts` with summary RPCs |
| Challenges (CRUD) | `challenges`, `challenge_tickets`, `milestones`, `milestone_media` | ✓ | ✗ (only read services exist) | ✗ | Highest priority — content team blocker |
| Clubs (moderate) | `clubs`, `club_members` | ✓ | ◐ (read + join/leave only) | ✗ | Needs admin-edit / suspend / delete |
| Milestones | `milestones`, `milestone_media`, `user_milestones` | ✓ | ✗ | ✗ | Nested under Challenges in UI |
| Coupons | **No table** | n/a | ✗ | ✗ | Schema not designed |
| Categories | **No table** (challenges have no category column) | n/a | ✗ | ✗ | Schema not designed |
| Homepage banners | **No table** | n/a | ✗ | ✗ | Schema not designed |
| Notifications | **No table** | n/a | ✗ | ✗ | Schema not designed; no edge function |
| Pages (CMS) | **No table** | n/a | ✗ | ✗ | Schema not designed |
| Testimonials | `testimonials` (10 cols) | ✓ | ✗ | ✗ | Table exists, no service or UI |
| Blog | `blog_posts` | ✓ | ◐ (read only) | ✗ | Add `createPost`, `updatePost`, `publish`, `unpublish` |
| Newsletter | **No table** | n/a | ✗ | ✗ | Schema not designed; no email provider |
| FAQ | **No table** | n/a | ✗ | ✗ | Schema not designed |
| Payment settings | `orders` (read) | ✓ admin SELECT | ✗ | ✗ | View-only is enough for now |
| Gallery | `gallery_images` | ✓ | ◐ (read only) | ✗ | Add admin upload via service |
| Contact enquiries inbox | `contact_enquiries` | ✓ | ◐ (submit only) | ✗ | Add `listEnquiries`, `markRead`, `delete` |
| Users + Roles | `profiles`, `user_roles`, `app_role` | ✓ admin manage | ✗ | ✗ | Needed to grant `club_owner` / `content_manager` |

## Cross-cutting requirements before building the Admin UI

1. **Layout shell**: `src/features/admin/components/AdminLayout.tsx` with sidebar nav + breadcrumb + role-aware nav items (super_admin sees Users/Roles).
2. **Form primitives**: extend shadcn `Form`, add image-upload widget that talks to a future `storage.service.ts`.
3. **Tables**: introduce a generic `<DataTable>` (TanStack Table) for list views; not currently in deps.
4. **Service expansion**: each domain needs `create`, `update`, `delete`, `setActive`, `reorder`, plus a `listAdmin()` that bypasses `is_active=true` filters.
5. **Audit log table** (new) — capture every admin mutation for traceability before launch.

## Recommended build order

1. Challenges + Tickets + Milestones (single nested editor) — unblocks content team.
2. Blog posts.
3. Contact enquiries inbox.
4. Testimonials + Gallery.
5. Users & Roles (super_admin only).
6. Coupons + Categories + Banners + FAQ + Notifications (new tables + new edge functions).
