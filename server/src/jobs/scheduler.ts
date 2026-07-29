/**
 * BullMQ scheduler — registers repeatable jobs for the platform.
 *
 * Cadence mirrors the retired Supabase pg_cron jobs:
 *   - Strava sync every 15 minutes for eligible users.
 *   - Registration expiry every 5 minutes.
 *   - Cleanup / retention every day at 03:15 IST.
 *
 * Scheduling is gated by env.ENABLE_SCHEDULER so Phase 7 remains inactive
 * until the compatibility layer flips.
 */
import { getQueue } from "./queue";
import { logger } from "../config/logger";
import { env } from "../config/env";

export async function bootstrapScheduler() {
  if (!env.ENABLE_SCHEDULER) {
    logger.info("Scheduler disabled (ENABLE_SCHEDULER=false)");
    return;
  }

  const stravaQ = getQueue("strava-sync");
  if (stravaQ) {
    await stravaQ.add(
      "cron-fanout",
      {},
      {
        repeat: { pattern: "*/15 * * * *" },
        jobId: "strava:cron-fanout",
        removeOnComplete: 200,
      },
    );
    logger.info("Scheduled: strava-sync cron-fanout every 15m");
  }

  const notifQ = getQueue("notifications");
  if (notifQ) {
    await notifQ.add(
      "expire-registrations",
      {},
      {
        repeat: { pattern: "*/5 * * * *" },
        jobId: "reg:expire",
        removeOnComplete: 500,
      },
    );
    await notifQ.add(
      "process-notifications",
      {},
      {
        repeat: { pattern: "*/2 * * * *" },
        jobId: "notif:process",
        removeOnComplete: 500,
      },
    );
    await notifQ.add(
      "cleanup",
      {},
      {
        repeat: { pattern: "45 21 * * *" }, // 03:15 IST daily
        jobId: "system:cleanup",
        removeOnComplete: 60,
      },
    );
    logger.info("Scheduled: registration-expiry, notification-processing, daily cleanup");
  }
}
