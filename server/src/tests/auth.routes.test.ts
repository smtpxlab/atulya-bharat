import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";

// These are shape/contract tests; they run without a DB connection.
// End-to-end auth flows are covered by integration tests in Phase 4b once
// a Railway PostgreSQL instance is wired up in CI.
const app = createApp();

describe("auth routes — contract", () => {
  it("rejects invalid register payloads with 400", async () => {
    const r = await request(app).post("/api/v1/auth/register").send({ email: "no", password: "x" });
    expect(r.status).toBe(400);
  });

  it("rejects invalid login payloads with 400", async () => {
    const r = await request(app).post("/api/v1/auth/login").send({});
    expect(r.status).toBe(400);
  });

  it("requires refresh token on /refresh (web: no cookie -> 401)", async () => {
    const r = await request(app).post("/api/v1/auth/refresh").send({});
    expect(r.status).toBe(401);
  });

  it("requires auth on GET /me", async () => {
    const r = await request(app).get("/api/v1/auth/me");
    expect(r.status).toBe(401);
  });

  it("accepts logout without a body", async () => {
    const r = await request(app).post("/api/v1/auth/logout").send({});
    expect(r.status).toBe(204);
  });
});
