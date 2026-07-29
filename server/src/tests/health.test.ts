import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";

describe("health endpoints", () => {
  const app = createApp();

  it("GET /api/v1/live returns 200", async () => {
    const res = await request(app).get("/api/v1/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("alive");
  });

  it("GET /api/v1/version returns package meta", async () => {
    const res = await request(app).get("/api/v1/version");
    expect(res.status).toBe(200);
    expect(res.body.name).toBeTruthy();
  });

  it("GET /api/v1/health responds (degraded acceptable without deps)", async () => {
    const res = await request(app).get("/api/v1/health");
    expect([200, 503]).toContain(res.status);
    expect(res.body.checks).toBeDefined();
  });
});
