import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";

/**
 * Contract tests for the mobile token transport (`X-Client-Type: mobile`).
 * These run without a database connection, so they assert transport/validation
 * behaviour only. Full login → refresh → reuse-detection flows are verified
 * end-to-end against the deployed Railway service (see docs/mobile).
 */
const app = createApp();

describe("auth — mobile token transport", () => {
  it("returns 400 with a clear message when a mobile refresh has no body token", async () => {
    const r = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-Client-Type", "mobile")
      .send({});
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("refreshToken");
  });

  it("treats the legacy 'native' client type the same way", async () => {
    const r = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-Client-Type", "native")
      .send({});
    expect(r.status).toBe(400);
  });

  it("header matching is case-insensitive on the value", async () => {
    const r = await request(app)
      .post("/api/v1/auth/refresh")
      .set("X-Client-Type", "Mobile")
      .send({});
    expect(r.status).toBe(400);
  });

  it("web refresh with no cookie and no body token stays 401", async () => {
    const r = await request(app).post("/api/v1/auth/refresh").send({});
    expect(r.status).toBe(401);
  });

  it("mobile logout succeeds without any CSRF header and sets no cookies", async () => {
    const r = await request(app)
      .post("/api/v1/auth/logout")
      .set("X-Client-Type", "mobile")
      .send({});
    expect(r.status).toBe(204);
    expect(r.headers["set-cookie"]).toBeUndefined();
  });

  it("web logout clears the refresh cookie", async () => {
    const r = await request(app).post("/api/v1/auth/logout").send({});
    expect(r.status).toBe(204);
    const cookies = (r.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
    expect(cookies.join(";")).toContain("abr_rt=");
  });

  it("mobile login still validates its payload", async () => {
    const r = await request(app)
      .post("/api/v1/auth/login")
      .set("X-Client-Type", "mobile")
      .send({ email: "not-an-email" });
    expect(r.status).toBe(400);
  });

  it("mobile requests are exempt from CSRF (no cookie credential present)", async () => {
    const r = await request(app)
      .post("/api/v1/auth/forgot-password")
      .set("X-Client-Type", "mobile")
      .send({ email: "nobody@example.com" });
    expect(r.status).not.toBe(403);
  });
});
