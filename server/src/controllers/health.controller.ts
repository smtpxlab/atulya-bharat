import type { Request, Response } from "express";
import { pingDb } from "../config/db";
import { pingRedis } from "../config/redis";
import pkg from "../../package.json";

const startedAt = Date.now();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Aggregate health status (DB + Redis).
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HealthStatus' }
 *       503:
 *         description: A dependency is unhealthy.
 */
export async function health(_req: Request, res: Response) {
  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
  const ok = db && redis;
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    uptime: (Date.now() - startedAt) / 1000,
    timestamp: new Date().toISOString(),
    version: (pkg as { version: string }).version,
    checks: { db, redis },
  });
}

/**
 * @openapi
 * /live:
 *   get:
 *     summary: Liveness probe — process is up.
 *     tags: [Health]
 *     responses:
 *       200: { description: alive }
 */
export function live(_req: Request, res: Response) {
  res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
}

/**
 * @openapi
 * /ready:
 *   get:
 *     summary: Readiness probe — dependencies reachable.
 *     tags: [Health]
 *     responses:
 *       200: { description: ready }
 *       503: { description: not ready }
 */
export async function ready(_req: Request, res: Response) {
  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
  const ok = db && redis;
  res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not_ready", checks: { db, redis } });
}

/**
 * @openapi
 * /version:
 *   get:
 *     summary: API version + build info.
 *     tags: [Health]
 *     responses:
 *       200: { description: version info }
 */
export function version(_req: Request, res: Response) {
  res.json({
    name: (pkg as { name: string }).name,
    version: (pkg as { version: string }).version,
    node: process.version,
    startedAt: new Date(startedAt).toISOString(),
  });
}
