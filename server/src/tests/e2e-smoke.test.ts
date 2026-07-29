/**
 * Phase 8A.5 — End-to-end smoke test (structure-only).
 *
 * Verifies that every route module the compatibility layer will call is
 * mounted and reachable through the Express app. It does NOT hit an external
 * database — it only asserts route registration and public-endpoint contracts
 * so that we can prove the wiring is correct before flipping
 * `VITE_BACKEND_ENABLED` to `true`.
 *
 * Full integration tests against a live Railway/R2/Redis stack are executed
 * by the deploy pipeline (see docs/audit/phase-8a5-e2e-validation-report.md).
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";

// Import the router aggregate so we don't need to boot the whole app (which
// requires DB/Redis env vars at import time).
import apiRouter from "../routes/index";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", apiRouter);
  return app;
}

describe("Phase 8A.5 — route surface", () => {
  const app = makeApp();

  const publicEndpoints = [
    "/api/v1/health",
    "/api/v1/challenges",
    "/api/v1/blogs",
    "/api/v1/pages",
    "/api/v1/gallery",
    "/api/v1/faqs",
    "/api/v1/testimonials",
    "/api/v1/clubs",
    "/api/v1/notifications",
    "/api/v1/storage/buckets",
  ];

  for (const path of publicEndpoints) {
    it(`GET ${path} is registered`, async () => {
      const res = await request(app).get(path);
      // We accept any non-404 status: 200/401/500 all mean "route exists".
      expect(res.status).not.toBe(404);
    });
  }

  const authRequired = [
    ["POST", "/api/v1/auth/logout"],
    ["GET", "/api/v1/auth/me"],
    ["POST", "/api/v1/payments/razorpay/orders"],
    ["POST", "/api/v1/strava/connect"],
    ["POST", "/api/v1/registrations"],
    ["POST", "/api/v1/orders"],
  ] as const;

  for (const [method, path] of authRequired) {
    it(`${method} ${path} rejects without auth (401)`, async () => {
      const req = request(app);
      const res =
        method === "GET" ? await req.get(path) : await req.post(path).send({});
      expect([400, 401, 403]).toContain(res.status);
    });
  }
});
