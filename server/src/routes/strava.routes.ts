import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import {
  assertWebhookToken,
  athleteStats,
  buildAuthUrl,
  connect,
  disconnect,
  processWebhookEvent,
  publicConfig,
  subscriptionHealth,
  syncUserActivities,
  usersDueForSync,
  verifyHandshake,
} from "../services/strava/strava.service";
import { getQueue } from "../jobs/queue";
import { logger } from "../config/logger";

const router = Router();

router.get(
  "/config",
  asyncHandler(async (_req, res) => {
    res.json({ data: publicConfig() });
  }),
);

router.get(
  "/auth-url",
  requireAuth,
  asyncHandler(async (req, res) => {
    const state = String(req.query.state ?? req.user!.sub);
    res.json({ data: { url: buildAuthUrl(state) } });
  }),
);

router.post(
  "/connect",
  requireAuth,
  validate(z.object({ code: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const result = await connect(req.user!.sub, req.body.code);
    res.json({ data: result });
  }),
);

router.post(
  "/disconnect",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await disconnect(req.user!.sub);
    res.json({ data: result });
  }),
);

router.get(
  "/athlete/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: await athleteStats(req.user!.sub) });
  }),
);

router.post(
  "/sync",
  requireAuth,
  asyncHandler(async (req, res) => {
    const fullMode = req.query.full === "true";
    const result = await syncUserActivities(req.user!.sub, "manual", { fullMode });
    res.json({ data: result });
  }),
);

/**
 * Admin: enqueue a background sync for all users due (or trigger inline).
 * Preserved from `strava-cron-sync`.
 */
router.post(
  "/cron-sync",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const users = await usersDueForSync();
    const q = getQueue("strava-sync");
    if (q) {
      for (const userId of users) {
        await q.add("sync-user", { userId, source: "cron" }, { jobId: `cron-${userId}` });
      }
      res.json({ data: { enqueued: users.length, mode: "queue" } });
      return;
    }
    // Fallback: inline
    let ok = 0;
    for (const userId of users) {
      const r = await syncUserActivities(userId, "cron").catch((err) => {
        logger.warn({ err, userId }, "cron sync failed");
        return null;
      });
      if (r?.ok) ok++;
    }
    res.json({ data: { processed: users.length, ok, mode: "inline" } });
  }),
);

router.get(
  "/webhook/health",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    res.json({ data: await subscriptionHealth() });
  }),
);

/**
 * Strava webhook verification handshake (GET) and event delivery (POST).
 * Public route — authenticity of POSTs is enforced via `?token=` param.
 */
router.get(
  "/webhook",
  asyncHandler(async (req, res) => {
    const result = verifyHandshake(
      (req.query["hub.mode"] as string) ?? null,
      (req.query["hub.verify_token"] as string) ?? null,
      (req.query["hub.challenge"] as string) ?? null,
    );
    if (!result) throw new HttpError(403, "STRAVA_HANDSHAKE_FAILED", "Forbidden");
    res.json(result);
  }),
);

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    assertWebhookToken((req.query.token as string) ?? null);
    const event = req.body;
    // Enqueue for background processing to avoid Strava retries on slow ingest.
    const q = getQueue("strava-sync");
    if (q) {
      await q.add("webhook-event", { event });
      res.status(200).send("ok");
      return;
    }
    processWebhookEvent(event).catch((err) =>
      logger.error({ err }, "strava webhook inline processing failed"),
    );
    res.status(200).send("ok");
  }),
);

export default router;
