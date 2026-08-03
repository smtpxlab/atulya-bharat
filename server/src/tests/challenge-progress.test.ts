/**
 * Priority 1 — Express re-implementations of the former Postgres functions.
 *
 * The pure helpers are asserted directly; the endpoints are asserted through
 * the real router with the progress service mocked, so we verify wiring,
 * argument shape, and authorization without needing a live database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const svc = vi.hoisted(() => ({
  activeRegistration: vi.fn(),
  challengeProgress: vi.fn(),
  progressByRegistration: vi.fn(),
  challengeLeaderboard: vi.fn(),
  logManualActivity: vi.fn(),
  registrationLoggedKm: vi.fn(),
  expireRegistrations: vi.fn(),
}));


vi.mock("../services/challenges/progress.service", async () => {
  const actual = await vi.importActual<
    typeof import("../services/challenges/progress.service")
  >("../services/challenges/progress.service");
  return { ...actual, ...svc };
});

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { sub: "user-1", roles: ["user"] };
    next();
  },
  optionalAuth: (req: any, _res: any, next: any) => {
    req.user = { sub: "user-1", roles: ["user"] };
    next();
  },
}));

import {
  activityTypeMatchesMode,
  allowedTypesForMode,
} from "../services/challenges/progress.service";
import challengesRoutes from "../routes/challenges.routes";
import registrationsRoutes from "../routes/registrations.routes";
import activitiesRoutes from "../routes/activities.routes";
import rpcRoutes from "../routes/rpc.routes";
import { errorHandler } from "../middleware/errorHandler";


function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/challenges", challengesRoutes);
  app.use("/registrations", registrationsRoutes);
  app.use("/activities", activitiesRoutes);
  app.use("/rpc", rpcRoutes);
  app.use(errorHandler);

  return app;
}

const REG = "11111111-1111-1111-1111-111111111111";
const CHAL = "22222222-2222-2222-2222-222222222222";

describe("activity mode matching (was _activity_type_matches_mode)", () => {
  it("accepts anything for 'any' or unknown modes", () => {
    expect(allowedTypesForMode("any")).toBeNull();
    expect(activityTypeMatchesMode("Ride", "any")).toBe(true);
    expect(activityTypeMatchesMode(null, null)).toBe(true);
  });

  it("matches run aliases case-insensitively", () => {
    expect(activityTypeMatchesMode("VirtualRun", "run")).toBe(true);
    expect(activityTypeMatchesMode("TrailRun", "run")).toBe(true);
    expect(activityTypeMatchesMode("walk", "run")).toBe(false);
  });

  it("matches walk and ride aliases", () => {
    expect(activityTypeMatchesMode("Hike", "walk")).toBe(true);
    expect(activityTypeMatchesMode("EBikeRide", "ride")).toBe(true);
    expect(activityTypeMatchesMode("run", "ride")).toBe(false);
  });
});

describe("Priority 1 endpoints", () => {
  const app = makeApp();

  beforeEach(() => {
    Object.values(svc).forEach((fn) => fn.mockReset());
  });

  it("GET /registrations/active returns the caller's active registration", async () => {
    svc.activeRegistration.mockResolvedValue({ registration_id: REG, total_km_logged: 12 });
    const res = await request(app).get("/registrations/active");
    expect(res.status).toBe(200);
    expect(res.body.data.registration_id).toBe(REG);
    expect(svc.activeRegistration).toHaveBeenCalledWith("user-1");
  });

  it("GET /challenges/:id/progress passes (userId, challengeId) in that order", async () => {
    svc.challengeProgress.mockResolvedValue({ pct_complete: 42 });
    const res = await request(app).get(`/challenges/${CHAL}/progress`);
    expect(res.status).toBe(200);
    expect(res.body.data.pct_complete).toBe(42);
    expect(svc.challengeProgress).toHaveBeenCalledWith("user-1", CHAL);
  });

  it("GET /challenges/:id/leaderboard clamps limit and offset", async () => {
    svc.challengeLeaderboard.mockResolvedValue([]);
    const res = await request(app).get(`/challenges/${CHAL}/leaderboard?limit=9999&offset=-5`);
    expect(res.status).toBe(200);
    expect(svc.challengeLeaderboard).toHaveBeenCalledWith(CHAL, 500, 0);
  });

  it("GET /registrations/:id/progress forbids reading another user's progress", async () => {
    svc.progressByRegistration.mockResolvedValue({ registration_id: REG, user_id: "someone-else" });
    const res = await request(app).get(`/registrations/${REG}/progress`);
    expect(res.status).toBe(403);
  });

  it("GET /registrations/:id/progress returns the caller's own progress", async () => {
    svc.progressByRegistration.mockResolvedValue({ registration_id: REG, user_id: "user-1" });
    const res = await request(app).get(`/registrations/${REG}/progress`);
    expect(res.status).toBe(200);
    expect(res.body.data.registration_id).toBe(REG);
  });

  it("POST /activities logs a manual activity with 5 mapped fields", async () => {
    svc.logManualActivity.mockResolvedValue({ ok: true, total_km_logged: 5 });
    const res = await request(app).post("/activities").send({
      registration_id: REG,
      activity_date: "2026-08-01",
      activity_type: "run",
      distance_km: 5,
      notes: "morning",
    });
    expect(res.status).toBe(201);
    expect(svc.logManualActivity).toHaveBeenCalledWith("user-1", {
      registration_id: REG,
      distance_km: 5,
      activity_date: "2026-08-01",
      activity_type: "run",
      notes: "morning",
    });
  });

  it("POST /activities rejects a non-positive distance before touching the DB", async () => {
    const res = await request(app).post("/activities").send({
      registration_id: REG,
      activity_date: "2026-08-01",
      activity_type: "run",
      distance_km: 0,
    });
    expect(res.status).toBe(400);
    expect(svc.logManualActivity).not.toHaveBeenCalled();
  });
});

describe("Priority 1 RPC compatibility endpoints", () => {
  const app = makeApp();

  beforeEach(() => {
    Object.values(svc).forEach((fn) => fn.mockReset());
  });

  it("rpc/active_registration ignores a spoofed _user_id argument", async () => {
    svc.activeRegistration.mockResolvedValue({ registration_id: REG });
    const res = await request(app)
      .post("/rpc/active_registration")
      .send({ _user_id: "attacker" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ registration_id: REG }]);
    expect(svc.activeRegistration).toHaveBeenCalledWith("user-1");
  });

  it("rpc/challenge_progress_by_registration returns a single-row array", async () => {
    svc.progressByRegistration.mockResolvedValue({ registration_id: REG, user_id: "user-1" });
    const res = await request(app)
      .post("/rpc/challenge_progress_by_registration")
      .send({ _registration_id: REG });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("rpc/challenge_leaderboard is callable with default paging", async () => {
    svc.challengeLeaderboard.mockResolvedValue([{ user_id: "user-1", km_logged: 10 }]);
    const res = await request(app)
      .post("/rpc/challenge_leaderboard")
      .send({ _challenge_id: CHAL });
    expect(res.status).toBe(200);
    expect(svc.challengeLeaderboard).toHaveBeenCalledWith(CHAL, 20, 0);
  });

  it("rpc/log_manual_activity maps snake_case args to the service input", async () => {
    svc.logManualActivity.mockResolvedValue({ ok: true });
    const res = await request(app).post("/rpc/log_manual_activity").send({
      _registration_id: REG,
      _distance_km: 7.5,
      _activity_date: "2026-08-02",
      _activity_type: "walk",
      _notes: null,
    });
    expect(res.status).toBe(200);
    expect(svc.logManualActivity).toHaveBeenCalledWith("user-1", {
      registration_id: REG,
      distance_km: 7.5,
      activity_date: "2026-08-02",
      activity_type: "walk",
      notes: null,
    });
  });

  it("rpc/challenge_progress requires a challenge id", async () => {
    const res = await request(app).post("/rpc/challenge_progress").send({});
    expect(res.status).toBe(400);
  });
});
