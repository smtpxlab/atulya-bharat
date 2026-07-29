# Admin API Contracts

All endpoints live under `/admin` and require:

- `Authorization: Bearer <jwt>` — issued by Lovable Cloud Auth.
- The authenticated user has the `admin` or `super_admin` role.

Response envelope:

```jsonc
// success
{ "data": <payload> }

// error
{ "error": { "code": "string", "message": "string", "details": {} } }
```

Status codes: `200` OK, `201` Created, `400` invalid body/query, `401`
unauthenticated, `403` not an admin, `404` not found, `405` method not allowed,
`500` internal.

---

## Dashboard

### `GET /admin/dashboard`

```json
{
  "data": {
    "usersCount": 0,
    "challengesCount": 0,
    "clubsCount": 0,
    "registrationsCount": 0
  }
}
```

---

## Challenges

### `GET /admin/challenges?q&status&page&pageSize`

`status` ∈ `all | draft | published`. Default `pageSize=20`, max 100.

```json
{ "data": { "items": [Challenge], "page": 1, "pageSize": 20, "total": 42 } }
```

### `POST /admin/challenges`

Body (zod):

```jsonc
{
  "title": "Bengaluru Marathon",
  "slug": "bengaluru-marathon",
  "city": "Bengaluru",
  "state": "KA",
  "total_distance_km": 42.2,
  "description_short": "Run the city",
  "description_long": "…",
  "cover_image_url": "https://…",
  "activity_modes": ["run", "walk"],
  "is_featured": false,
  "is_new": true,
  "is_active": false,
  "sort_order": 10
}
```

→ `201 { "data": Challenge }`

### `GET /admin/challenges/:id` → `{ "data": Challenge }`
### `PUT /admin/challenges/:id` — partial body, same shape as POST.
### `DELETE /admin/challenges/:id` → `{ "data": { "id": "uuid" } }`

---

## Clubs

### `GET /admin/clubs?q&status&categoryId&page&pageSize`

`status` ∈ `draft | published | suspended`. Returns clubs with joined
`promoter` and `social_links`.

### `POST /admin/clubs`

```jsonc
{
  "name": "Pacers BLR",
  "slug": "pacers-blr",
  "description": "…",
  "logo_url": "https://…",
  "banner_url": "https://…",
  "promoter_id": "uuid",
  "is_public": true,
  "status": "draft",
  "registration_code": "PACE2026",
  "referral_code": "PACERS",
  "discount_challenge_percent": 10,
  "discount_cart_percent": 5,
  "established_at": "2022-01-15",
  "category_id": "uuid",
  "social_links": [
    { "platform": "instagram", "url": "https://instagram.com/pacers" }
  ]
}
```

### `GET /admin/clubs/:id`
Returns the club + `social_links[]` + `promoter` (joined from `profiles`).
Promoter `name/email/phone` are read-only and never duplicated on `clubs`.

### `PUT /admin/clubs/:id`
Partial body. If `social_links` is present, it **replaces** the entire set.

### `DELETE /admin/clubs/:id`

### `GET /admin/clubs/:id/members`
```json
{ "data": { "items": [{ "id": "...", "role": "member", "joined_at": "...", "user": { "id": "...", "full_name": "...", "city": "..." } }] } }
```

### `GET /admin/clubs/reports`
```json
{
  "data": {
    "counts": { "total": 0, "draft": 0, "published": 0, "suspended": 0 },
    "topByMembers": [{ "id": "...", "name": "...", "slug": "...", "status": "published", "member_count": 0 }]
  }
}
```

---

## Milestones

### `GET /admin/milestones?q&challengeId&page&pageSize`
### `POST /admin/milestones`

```jsonc
{
  "challenge_id": "uuid",
  "sequence_no": 1,
  "title": "Lalbagh",
  "landmark_name": "Lalbagh Gate",
  "unlock_at_km": 5.0,
  "description": "…",
  "fun_fact": "…"
}
```

### `GET /admin/milestones/:id`
Includes `challenge` and `media[]` (from `milestone_media`).

### `PUT /admin/milestones/:id`
### `DELETE /admin/milestones/:id`
