import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireRole, hasAnyRole, isAdmin, APP_ROLES } from "../middleware/requireRole";
import { stripSecrets, sanitizeResponse } from "../middleware/sanitizeResponse";

const run = (roles: string[] | undefined, allowed: Parameters<typeof requireRole>) => {
  const next = vi.fn() as unknown as NextFunction;
  const req = { user: roles ? { sub: "u1", roles } : undefined } as unknown as Request;
  requireRole(...allowed)(req, {} as Response, next);
  return (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
};

describe("requireRole", () => {
  it("matches the database app_role enum", () => {
    expect([...APP_ROLES]).toEqual([
      "admin",
      "user",
      "club_owner",
      "content_manager",
      "super_admin",
    ]);
  });

  it("lets super_admin through admin-gated routes", () => {
    expect(run(["super_admin"], ["admin"])).toBeUndefined();
    expect(isAdmin(["super_admin"])).toBe(true);
  });

  it("lets admin through admin-gated routes", () => {
    expect(run(["admin"], ["admin"])).toBeUndefined();
  });

  it("rejects non-admin roles", () => {
    expect(run(["user"], ["admin"])).toBeTruthy();
    expect(run(["club_owner"], ["admin"])).toBeTruthy();
    expect(run(["content_manager"], ["admin"])).toBeTruthy();
    expect(isAdmin(["user"])).toBe(false);
  });

  it("rejects unauthenticated callers", () => {
    expect(run(undefined, ["admin"])).toBeTruthy();
  });

  it("does not widen non-admin requirements", () => {
    expect(hasAnyRole(["super_admin"], ["club_owner"])).toBe(false);
  });
});

describe("sanitizeResponse", () => {
  it("strips strava tokens and gateway secrets at any depth", () => {
    const out = stripSecrets({
      data: [
        { user_id: "u1", access_token: "a", refresh_token: "r", strava_athlete_id: 1 },
        { provider: "razorpay", key_id: "k", key_secret: "s", is_active: true },
      ],
    }) as any;
    expect(JSON.stringify(out)).not.toMatch(/access_token|refresh_token|key_secret/);
    expect(out.data[0].strava_athlete_id).toBe(1);
    expect(out.data[1].key_id).toBe("k");
  });

  it("wraps res.json for non-auth routes", () => {
    const sent: unknown[] = [];
    const res = { json: (b: unknown) => sent.push(b) } as unknown as Response;
    sanitizeResponse({ path: "/strava/status" } as Request, res, (() => {}) as NextFunction);
    res.json({ access_token: "a", ok: true });
    expect(sent[0]).toEqual({ ok: true });
  });

  it("leaves auth session responses untouched", () => {
    const sent: unknown[] = [];
    const res = { json: (b: unknown) => sent.push(b) } as unknown as Response;
    sanitizeResponse({ path: "/auth/login" } as Request, res, (() => {}) as NextFunction);
    res.json({ accessToken: "a", refreshToken: "r" });
    expect(sent[0]).toEqual({ accessToken: "a", refreshToken: "r" });
  });
});
