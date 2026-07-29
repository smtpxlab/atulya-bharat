export type ClubStatus = "pending" | "approved" | "rejected";

export const CLUB_TYPES = [
  "Running",
  "Cycling/Riding",
  "Fitness/Gym",
  "Zumba",
  "Swimming",
  "Yoga",
  "Professionals",
  "Corporates",
  "Influencers",
] as const;
export type ClubType = (typeof CLUB_TYPES)[number];

export type Club = {
  id: string;
  slug: string;
  name: string;
  club_type: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  promoter_id: string | null;
  promoter_name: string | null;
  /** Promoter PII fields — only present for admin/owner reads (base table).
   *  Public reads come from `list_public_clubs` / `get_public_club_by_slug`
   *  which omit these columns entirely. */
  promoter_email?: string | null;
  promoter_phone?: string | null;
  promoter_address?: string | null;
  promoter_dob?: string | null;
  promoter_city: string | null;
  promoter_state: string | null;
  promoter_description: string | null;
  established_at: string | null;
  registration_code?: string | null;
  referral_code?: string | null;
  discount_challenge_percent: number;
  discount_cart_percent: number;
  social_links: string[];
  tags: string[];
  is_public: boolean;
  status: ClubStatus;
  priority: number;
  member_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string[];
};

export type ClubMember = {
  id: string;
  club_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type MyClub = {
  id: string;
  club_id: string;
  joined_at: string;
  club: Pick<
    Club,
    "id" | "slug" | "name" | "logo_url" | "banner_url" | "status" | "is_public" | "member_count"
  >;
};
