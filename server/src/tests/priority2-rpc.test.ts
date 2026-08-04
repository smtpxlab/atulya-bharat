/**
 * Priority 2 — Express re-implementations of the remaining Postgres functions.
 *
 * The RPC surface is exercised through the real router with the new services
 * mocked, so we assert wiring, argument mapping, and authorization gates
 * without needing a live database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const coupons = vi.hoisted(() => ({
  validateCoupon: vi.fn(),
  incrementCouponUsage: vi.fn(),
}));
const newsletter = vi.hoisted(() => ({ subscribeToNewsletter: vi.fn() }));
const clubs = vi.hoisted(() => ({
  listPublicClubs: vi.fn(),
  getPublicClubBySlug: vi.fn(),
  listClubMembers: vi.fn(),
  canSeeClubMembers: vi.fn(),
  recomputeClubMemberCount: vi.fn(),
}));
const leaderboard = vi.hoisted(() => ({
  globalLeaderboard: vi.fn(),
  hallOfFame: vi.fn(),
}));
const admin = vi.hoisted(() => ({
  adminBookingStats: vi.fn(),
  adminChallengeParticipantStats: vi.fn(),
  adminListChallengeParticipants: vi.fn(),
  adminForceCompleteRegistration: vi.fn(),
}));

const auth = vi.hoisted(() => ({ user: undefined as any }));

vi.mock("../services/coupons/coupon.service", () => coupons);
vi.mock("../services/newsletter/newsletter.service", () => newsletter);
vi.mock("../services/clubs/clubs.service", () => clubs);
vi.mock("../services/leaderboard/leaderboard.service", () => leaderboard);
vi.mock("../services/admin/admin.service", () => admin);

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!auth.user) return res.status(401).json({ error: { message: "unauthorized" } });
    req.user = auth.user;
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    req.user = auth.user;
    next();
  },
}));

import rpcRoutes from "../routes/rpc.routes";
import clubsRoutes from "../routes/clubs.routes";
import { errorHandler } from "../middleware/errorHandler";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/rpc", rpcRoutes);
  app.use("/clubs", clubsRoutes);
  app.use(errorHandler);
  return app;
}

const asUser = () => (auth.user = { sub: "user-1", roles: ["user"] });
const asAdmin = () => (auth.user = { sub: "admin-1", roles: ["admin"] });
const asAnon = () => (auth.user = undefined);

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
});

describe("coupons", () => {
  it("validates a coupon for an authenticated caller", async () => {
    coupons.validateCoupon.mockResolvedValue({ valid: true, discount: 100 });
    const res = await request(makeApp())
      .post("/rpc/validate_coupon")
      .send({ _code: "SAVE10", _subtotal: 1000 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valid: true, discount: 100 });
    expect(coupons.validateCoupon).toHaveBeenCalledWith("SAVE10", 1000);
  });

  it("returns auth_required instead of a discount for anonymous callers", async () => {
    asAnon();
    const res = await request(makeApp())
      .post("/rpc/validate_coupon")
      .send({ _code: "SAVE10", _subtotal: 1000 });
    expect(res.body).toEqual({ valid: false, reason: "auth_required" });
    expect(coupons.validateCoupon).not.toHaveBeenCalled();
  });

  it("requires auth to increment usage", async () => {
    asAnon();
    const res = await request(makeApp()).post("/rpc/increment_coupon_usage").send({ _code: "X" });
    expect(res.status).toBe(401);
  });
});

describe("newsletter", () => {
  it("subscribes without auth", async () => {
    asAnon();
    newsletter.subscribeToNewsletter.mockResolvedValue({ status: "subscribed" });
    const res = await request(makeApp())
      .post("/rpc/subscribe_to_newsletter")
      .send({ _email: "a@b.com", _source: "footer" });
    expect(res.status).toBe(200);
    expect(newsletter.subscribeToNewsletter).toHaveBeenCalledWith("a@b.com", "footer");
  });
});

describe("clubs", () => {
  it("lists public clubs anonymously", async () => {
    asAnon();
    clubs.listPublicClubs.mockResolvedValue([{ id: "c1" }]);
    const res = await request(makeApp()).post("/rpc/list_public_clubs").send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "c1" }]);
  });

  it("wraps get_public_club_by_slug in an array", async () => {
    asAnon();
    clubs.getPublicClubBySlug.mockResolvedValue({ id: "c1", slug: "runners" });
    const res = await request(makeApp())
      .post("/rpc/get_public_club_by_slug")
      .send({ _slug: "runners" });
    expect(res.body).toEqual([{ id: "c1", slug: "runners" }]);
  });

  it("returns an empty member list when the club is not visible", async () => {
    clubs.canSeeClubMembers.mockResolvedValue(false);
    const res = await request(makeApp())
      .post("/rpc/list_club_members")
      .send({ _club_id: "c1" });
    expect(res.body).toEqual([]);
    expect(clubs.listClubMembers).not.toHaveBeenCalled();
  });

  it("returns members when visible", async () => {
    clubs.canSeeClubMembers.mockResolvedValue(true);
    clubs.listClubMembers.mockResolvedValue([{ user_id: "u1", is_owner: true }]);
    const res = await request(makeApp())
      .post("/rpc/list_club_members")
      .send({ _club_id: "c1" });
    expect(res.body).toEqual([{ user_id: "u1", is_owner: true }]);
  });

  it("forbids the members REST route for a private club", async () => {
    clubs.canSeeClubMembers.mockResolvedValue(false);
    const res = await request(makeApp()).get("/clubs/c1/members");
    expect(res.status).toBe(403);
  });

  it("gates recompute_club_member_count behind admin", async () => {
    const res = await request(makeApp())
      .post("/rpc/recompute_club_member_count")
      .send({ _club_id: "c1" });
    expect(res.status).toBe(403);
    asAdmin();
    clubs.recomputeClubMemberCount.mockResolvedValue(3);
    const ok = await request(makeApp())
      .post("/rpc/recompute_club_member_count")
      .send({ _club_id: "c1" });
    expect(ok.body).toBe(3);
  });
});

describe("leaderboards", () => {
  it("serves the global leaderboard publicly with clamped limits", async () => {
    asAnon();
    leaderboard.globalLeaderboard.mockResolvedValue([]);
    await request(makeApp()).post("/rpc/global_leaderboard").send({ _limit: 9999, _offset: -5 });
    expect(leaderboard.globalLeaderboard).toHaveBeenCalledWith(500, 0);
  });

  it("serves hall of fame publicly", async () => {
    asAnon();
    leaderboard.hallOfFame.mockResolvedValue([{ user_id: "u1" }]);
    const res = await request(makeApp()).post("/rpc/hall_of_fame").send({ _limit: 10 });
    expect(res.body).toEqual([{ user_id: "u1" }]);
    expect(leaderboard.hallOfFame).toHaveBeenCalledWith(10);
  });
});

describe("admin RPCs", () => {
  it("rejects non-admin callers", async () => {
    for (const fn of [
      "admin_booking_stats",
      "admin_challenge_participant_stats",
      "admin_list_challenge_participants",
      "admin_force_complete_registration",
    ]) {
      const res = await request(makeApp()).post(`/rpc/${fn}`).send({});
      expect(res.status, fn).toBe(403);
    }
  });

  it("returns booking stats for admins", async () => {
    asAdmin();
    admin.adminBookingStats.mockResolvedValue({ bookings_total: 2, revenue_paise: 500 });
    const res = await request(makeApp()).post("/rpc/admin_booking_stats").send({});
    expect(res.body.bookings_total).toBe(2);
    expect(admin.adminBookingStats).toHaveBeenCalledWith(null);
  });

  it("passes participant list filters through", async () => {
    asAdmin();
    admin.adminListChallengeParticipants.mockResolvedValue([]);
    await request(makeApp())
      .post("/rpc/admin_list_challenge_participants")
      .send({ _challenge_id: "ch1", _search: "bot", _status: "active", _limit: 10, _offset: 20 });
    expect(admin.adminListChallengeParticipants).toHaveBeenCalledWith("ch1", {
      search: "bot",
      status: "active",
      limit: 10,
      offset: 20,
    });
  });

  it("force-completes a registration", async () => {
    asAdmin();
    admin.adminForceCompleteRegistration.mockResolvedValue({ ok: true, added_km: 5 });
    const res = await request(makeApp())
      .post("/rpc/admin_force_complete_registration")
      .send({ _registration_id: "reg1" });
    expect(res.body).toEqual({ ok: true, added_km: 5 });
    expect(admin.adminForceCompleteRegistration).toHaveBeenCalledWith("reg1");
  });
});

describe("unknown functions", () => {
  it("404s on an unmapped RPC name", async () => {
    const res = await request(makeApp()).post("/rpc/drop_everything").send({});
    expect(res.status).toBe(404);
  });
});
