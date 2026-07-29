# Database Gap Analysis — Clubs Admin

Comparison of the admin Clubs form against the live `public.clubs` schema.

| Required field | Current column | Migration needed? |
| --- | --- | --- |
| `registration_code` | `clubs.registration_code text UNIQUE` | No |
| `discount_challenge_percent` | `clubs.discount_challenge_percent numeric(5,2) NOT NULL DEFAULT 0` | No |
| `discount_cart_percent` | `clubs.discount_cart_percent numeric(5,2) NOT NULL DEFAULT 0` | No |
| `referral_code` | `clubs.referral_code text UNIQUE` | No |
| `social_links` | child table `public.club_social_links(club_id, platform, url)` | No |
| `banner_url` | `clubs.banner_url text` | No |
| `established_at` | `clubs.established_at date` | No |
| `category_id` | `clubs.category_id uuid` (no FK, no lookup table) | **Yes** — see below |
| `status` | `clubs.status text NOT NULL DEFAULT 'draft'` with CHECK `(draft, published, suspended)` | No |

## Deferred migration outline (NOT executed in this phase)

```sql
-- 1. Lookup table
CREATE TABLE public.club_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.club_categories TO anon, authenticated;
GRANT ALL ON public.club_categories TO service_role;

ALTER TABLE public.club_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club categories"
  ON public.club_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage club categories"
  ON public.club_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. FK on clubs
ALTER TABLE public.clubs
  ADD CONSTRAINT clubs_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.club_categories(id) ON DELETE SET NULL;
```

Until this lands, the admin Clubs form renders `category_id` as a free-text UUID
input with a "Category picker coming in schema update" hint.

## Promoter de-duplication

`promoter_name`, `promoter_email`, `promoter_phone` are **not** added to
`clubs`. Promoter identity lives on `profiles`, joined via `clubs.promoter_id`.
The admin API returns the promoter as a nested `promoter: { id, full_name,
avatar_url }` object.
