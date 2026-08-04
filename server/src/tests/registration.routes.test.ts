/**
 * Express re-implementation of register_for_challenge / cancel_active_registration.
 * Pure mode-defaulting is asserted directly; the routes are asserted through the
 * real router with the service mocked (wiring + status codes + identity).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const svc = vi.hoisted(() => ({
  registerForChallenge: vi.fn(),
  cancelActiveRegistration: vi.fn(),
}));

vi.mock("../services/challenges/registration.service", async () => {
  const actual = await vi.importActual<
    typeof import("../services/challenges/registration.service")
  >("../services/challenges/registration.service");
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

import { defaultActivityMode } from "../services/challenges/registration.service";
import registrationsRoutes from "../routes/registrations.routes";
import rpcRoutes from "../routes/rpc.routes";
import { errorHandler } from "../middleware/errorHandler";

const CHAL = "22222222-2222-2222-2222-222222222222";
const TICKET = "33333333-3333-3333-3333-333333333333";
const REG = "11111111-1111-1111-1111-111111111111";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/registrations", registrationsRoutes);
  app.use("/rpc", rpcRoutes);
  app.use(errorHandler);
  return app;
}

describe("activity_mode defaulting (was register_for_challenge CASE block)", () => {
  it("keeps an explicit mode", () => {
    expect(defaultActivityMode("ride", "Run")).toBe("ride");
  });
  it("derives from challenge_type when unset or 'any'", () => {
    expect(defaultActivityMode(null, "Run/Walk")).toBe("walk");
    expect(defaultActivityMode("any", "Run")).toBe("run");
    expect(defaultActivityMode("", "Cycling event")).toBe("ride");
    expect(defaultActivityMode("", "Something else")).toBe("any");
  });
});

describe("registration endpoints", () => {
  const app = makeApp();
  beforeEach(() => Object.values(svc).forEach((f) => f.mockReset()));

  it("POST /registrations creates for the caller and returns 201", async () => {
    svc.registerForChallenge.mockResolvedValue({ ok: true, registration_id: REG });
    const res = await request(app).post("/registrations").send({
      challenge_id: CHAL,
      ticket_id: TICKET,
      activity_mode: "run",
      target_days: 10,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.registration_id).toBe(REG);
    expect(svc.registerForChallenge).toHaveBeenCalledWith("user-1", {
      challenge_id: CHAL,
      ticket_id: TICKET,
      activity_mode: "run",
      target_days: 10,
    });
  });

  it("POST /registrations returns 409 when another challenge is active", async () => {
    svc.registerForChallenge.mockResolvedValue({
      ok: false,
      error: "active_challenge_exists",
      registration_id: REG,
    });
    const res = await request(app)
      .post("/registrations")
      .send({ challenge_id: CHAL, ticket_id: TICKET, activity_mode: "run", target_days: 10 });
    expect(res.status).toBe(409);
  });

  it("POST /registrations/:id/cancel cancels the caller's registration", async () => {
    svc.cancelActiveRegistration.mockResolvedValue({ ok: true, registration_id: REG });
    const res = await request(app).post(`/registrations/${REG}/cancel`);
    expect(res.status).toBe(200);
    expect(svc.cancelActiveRegistration).toHaveBeenCalledWith("user-1", REG);
  });

  it("rpc/register_for_challenge ignores a spoofed _user_id", async () => {
    svc.registerForChallenge.mockResolvedValue({ ok: true, registration_id: REG });
    const res = await request(app)
      .post("/rpc/register_for_challenge")
      .send({ _user_id: "attacker", _challenge_id: CHAL, _ticket_id: TICKET, _target_days: 5 });
    expect(res.status).toBe(200);
    expect(svc.registerForChallenge).toHaveBeenCalledWith("user-1", {
      challenge_id: CHAL,
      ticket_id: TICKET,
      activity_mode: null,
      target_days: 5,
    });
  });

  it("rpc/cancel_active_registration is scoped to the caller", async () => {
    svc.cancelActiveRegistration.mockResolvedValue({ ok: false, error: "no_active_registration" });
    const res = await request(app).post("/rpc/cancel_active_registration").send({});
    expect(res.status).toBe(200);
    expect(svc.cancelActiveRegistration).toHaveBeenCalledWith("user-1", null);
  });
});
