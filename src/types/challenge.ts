// Domain types for the Challenges module.
//
// Phase 1 (Admin) renames `title→name`, `total_distance_km→distance`, drops
// city/state/activity_modes/etc. The shim below keeps legacy field names
// available as derived aliases so older public pages (Challenges, ChallengeDetail,
// ChallengeCard, Dashboard, Leaderboard, RegistrationModal) keep working without
// a full UI rewrite. New code MUST use the canonical field names.

export type ActivityMode = "run" | "walk" | "ride" | "any";
export type ChallengeType = "Any" | "Ride" | "Run/Walk";
export type ChallengeCategory = "New" | "Featured" | "Popular" | "Best Seller";

export type Challenge = {
  id: string;
  slug: string;
  name: string;
  challenge_type: ChallengeType;
  category: ChallengeCategory;
  tags: string[];
  cover_image_url: string | null;
  about_map_image_url: string | null;
  creative_image_url: string | null;
  certificate_image_url: string | null;
  bib_image_url: string | null;
  route_map_image_url: string | null;
  distance: number;
  max_duration_days: number | null;
  start_at: string | null;
  end_at: string | null;
  description: string | null;
  status: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[];

  // --- Legacy aliases (derived) — used by older public pages -----------------
  title: string;
  city: string;
  state: string | null;
  total_distance_km: number;
  description_short: string | null;
  description_long: string | null;
  activity_modes: string[];
  is_featured: boolean;
  is_new: boolean;
  is_active: boolean;
  sort_order: number;
};

export type ChallengeListItem = Challenge & {
  /** Lowest ticket price (in rupees). `null` when no tickets are configured. */
  min_price: number | null;
};

export type ChallengeTicket = {
  id: string;
  challenge_id: string;
  ticket_name: string;
  ticket_price: number;
  ticket_inclusions: string | null;
  shipping_cost: number;
  allow_certificate: boolean;

  // --- Legacy aliases --------------------------------------------------------
  name: string;                   // = ticket_name
  price_inr: number;              // = ticket_price * 100 (rupees → paise) for legacy UI
  includes: string[] | null;      // derived from ticket_inclusions
  includes_medal: boolean;        // = allow_certificate
  sort_order: number;             // legacy, always 0
};

export type ChallengeDetail = {
  challenge: Challenge;
  tickets: ChallengeTicket[];
};

// --- Row → domain mappers ---------------------------------------------------

const activityModesFor = (type: ChallengeType): string[] => {
  if (type === "Ride") return ["ride"];
  if (type === "Run/Walk") return ["run", "walk"];
  return ["any"];
};

export const challengeFromRow = (r: any): Challenge => {
  const challenge_type: ChallengeType = (r.challenge_type ?? "Any") as ChallengeType;
  const category: ChallengeCategory = (r.category ?? "New") as ChallengeCategory;
  const name: string = r.name ?? r.title ?? "";
  const distance = Number(r.distance ?? r.total_distance_km ?? 0);
  const status = r.status ?? r.is_active ?? true;
  const tags: string[] = Array.isArray(r.tags)
    ? r.tags.filter((t: unknown): t is string => typeof t === "string" && t.length > 0)
    : [];
  return {
    id: r.id,
    slug: r.slug,
    name,
    challenge_type,
    category,
    tags,
    cover_image_url: r.cover_image_url ?? null,
    about_map_image_url: r.about_map_image_url ?? null,
    creative_image_url: r.creative_image_url ?? null,
    certificate_image_url: r.certificate_image_url ?? null,
    bib_image_url: r.bib_image_url ?? null,
    route_map_image_url: r.route_map_image_url ?? null,
    distance,
    max_duration_days: r.max_duration_days ?? null,
    start_at: r.start_at ?? null,
    end_at: r.end_at ?? null,
    description: r.description ?? null,
    status,
    created_by: r.created_by ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at ?? r.created_at,
    meta_title: r.meta_title ?? null,
    meta_description: r.meta_description ?? null,
    meta_keywords: Array.isArray(r.meta_keywords) ? r.meta_keywords : [],


    title: name,
    city: "",
    state: null,
    total_distance_km: distance,
    description_short: null,
    description_long: r.description ?? null,
    activity_modes: activityModesFor(challenge_type),
    is_featured: category === "Featured",
    is_new: category === "New",
    is_active: !!status,
    sort_order: 0,
  };
};

export const ticketFromRow = (r: any): ChallengeTicket => {
  const ticket_name: string = r.ticket_name ?? r.name ?? "";
  const ticket_price = Number(r.ticket_price ?? 0);
  const ticket_inclusions: string | null = r.ticket_inclusions ?? null;
  const allow_certificate = !!r.allow_certificate;
  return {
    id: r.id,
    challenge_id: r.challenge_id,
    ticket_name,
    ticket_price,
    ticket_inclusions,
    shipping_cost: Number(r.shipping_cost ?? 0),
    allow_certificate,
    // Legacy aliases
    name: ticket_name,
    price_inr: Math.round(ticket_price * 100),
    includes: ticket_inclusions
      ? ticket_inclusions.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      : null,
    includes_medal: allow_certificate,
    sort_order: 0,
  };
};

