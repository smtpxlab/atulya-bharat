/**
 * Centralized React Query key factory.
 *
 * Use these everywhere so invalidations stay consistent. Never inline
 * `['challenges', ...]` arrays in components.
 */
export const qk = {
  challenges: {
    all: ["challenges"] as const,
    list: () => ["challenges", "list"] as const,
    detail: (slug: string) => ["challenges", "detail", slug] as const,
    leaderboard: (id: string) => ["challenges", "leaderboard", id] as const,
    admin: {
      all: ["challenges", "admin"] as const,
      list: (params: Record<string, unknown>) =>
        ["challenges", "admin", "list", params] as const,
      detail: (id: string) => ["challenges", "admin", "detail", id] as const,
    },
  },
  clubs: {
    all: ["clubs"] as const,
    list: () => ["clubs", "list"] as const,
    bySlug: (slug: string) => ["clubs", "bySlug", slug] as const,
    detail: (slug: string) => ["clubs", "detail", slug] as const,
    myClubs: (userId: string) => ["clubs", "myClubs", userId] as const,
    memberships: (userId: string) => ["clubs", "memberships", userId] as const,
    members: (clubId: string) => ["clubs", "members", clubId] as const,
  },
  profile: {
    me: (userId: string) => ["profile", userId] as const,
  },
  adminProfile: {
    me: (userId: string) => ["admin-profile", userId] as const,
  },
  registrations: {
    all: ["registrations"] as const,
    mine: (userId: string) => ["registrations", "mine", userId] as const,
  },
  blog: {
    all: ["blog"] as const,
    list: (tag?: string) => ["blog", "list", tag ?? null] as const,
    detail: (slug: string) => ["blog", "detail", slug] as const,
    tags: () => ["blog", "tags"] as const,
  },
  gallery: {
    all: ["gallery"] as const,
    public: () => ["gallery", "public"] as const,
    list: (challengeId?: string) => ["gallery", "list", challengeId ?? null] as const,
  },
  pages: {
    all: ["pages"] as const,
    list: () => ["pages", "list"] as const,
    detail: (slug: string) => ["pages", "detail", slug] as const,
    admin: {
      all: ["admin", "pages"] as const,
      list: (filters: Record<string, unknown>) =>
        ["admin", "pages", "list", filters] as const,
      detail: (id: string) => ["admin", "pages", "detail", id] as const,
    },
  },
  dashboard: {
    createdClubs: (userId: string) => ["dashboard", "created-clubs", userId] as const,
    joinedClubs: (userId: string) => ["dashboard", "joined-clubs", userId] as const,
  },
  adminClubs: {
    memberReport: ["admin-clubs", "member-report"] as const,
  },
  coupons: {
    all: ["coupons"] as const,
    list: (params: Record<string, unknown>) => ["coupons", "list", params] as const,
    detail: (id: string) => ["coupons", "detail", id] as const,
  },
  milestones: {
    all: ["milestones"] as const,
    list: (params: Record<string, unknown>) => ["milestones", "list", params] as const,
    detail: (id: string) => ["milestones", "detail", id] as const,
  },
  testimonials: {
    all: ["testimonials"] as const,
    public: () => ["testimonials", "public"] as const,
    adminList: (params: Record<string, unknown>) =>
      ["testimonials", "admin", "list", params] as const,
    detail: (id: string) => ["testimonials", "detail", id] as const,
  },
  faqs: {
    all: ["faqs"] as const,
    public: () => ["faqs", "public"] as const,
    adminList: (params: Record<string, unknown>) =>
      ["faqs", "admin", "list", params] as const,
    detail: (id: string) => ["faqs", "detail", id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    publicActive: () => ["notifications", "public", "active"] as const,
    adminList: (params: Record<string, unknown>) =>
      ["notifications", "admin", "list", params] as const,
    detail: (id: string) => ["notifications", "detail", id] as const,
  },
} as const;
