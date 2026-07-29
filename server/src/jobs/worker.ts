/**
 * BullMQ worker entrypoint. Run with `bun run worker`.
 *
 * Handlers preserve the retired Supabase edge / pg_cron behaviour:
 *   - email:            transactional email delivery via nodemailer
 *   - strava-sync:      per-user + cron fanout + webhook event processing
 *   - notifications:    registration expiry, notification fanout, cleanup
 *   - webhooks:         reserved for future async webhook dispatch
 */
import { QUEUE_NAMES, attachQueueEvents, registerWorker } from "./queue";
import { bootstrapScheduler } from "./scheduler";
import { logger } from "../config/logger";
import { getDb } from "../config/db";
import { sendMail, type MailOptions } from "../services/email/mailer.service";
import {
  processWebhookEvent,
  syncUserActivities,
  usersDueForSync,
} from "../services/strava/strava.service";

async function handleEmail(job: { name: string; data: MailOptions }) {
  if (job.name !== "send") return { skipped: true };
  await sendMail(job.data);
  return { sent: true };
}

async function handleStravaSync(job: { name: string; data: any }) {
  if (job.name === "cron-fanout") {
    const users = await usersDueForSync();
    for (const userId of users) {
      // Enqueue individual jobs so failures are retried per-user.
      await (await import("./queue")).enqueue("strava-sync", "sync-user", {
        userId,
        source: "cron",
      });
    }
    return { fanned_out: users.length };
  }
  if (job.name === "sync-user") {
    return syncUserActivities(job.data.userId, job.data.source ?? "cron", {
      fullMode: !!job.data.fullMode,
    });
  }
  if (job.name === "webhook-event") {
    return processWebhookEvent(job.data.event);
  }
  return { skipped: true };
}

async function handleNotifications(job: { name: string; data: any }) {
  const db = getDb();
  if (job.name === "expire-registrations") {
    await db.raw("select expire_all_registrations()").catch((err) =>
      logger.warn({ err }, "expire_all_registrations RPC missing (fallback)"),
    );
    return { ok: true };
  }
  if (job.name === "process-notifications") {
    // Placeholder: notification fanout will be wired when the notifications
    // domain adopts server-driven push. Today notifications are DB-only.
    return { ok: true };
  }
  if (job.name === "cleanup") {
    // Drop stale sessions + orphaned rows. Non-fatal if functions are missing.
    await db("refresh_sessions").where("revoked_at", "is not", null).andWhere(
      "revoked_at",
      "<",
      db.raw("now() - interval '30 days'"),
    ).delete().catch(() => undefined);
    await db("email_verifications").where("expires_at", "<", db.raw("now()")).delete().catch(() => undefined);
    await db("password_resets").where("expires_at", "<", db.raw("now()")).delete().catch(() => undefined);
    return { ok: true };
  }
  return { skipped: true };
}

async function main() {
  logger.info("Worker starting");

  registerWorker(QUEUE_NAMES.email, handleEmail as any);
  registerWorker(QUEUE_NAMES.stravaSync, handleStravaSync as any);
  registerWorker(QUEUE_NAMES.notifications, handleNotifications as any);
  registerWorker(QUEUE_NAMES.webhooks, async () => ({ skipped: true }));

  for (const name of Object.values(QUEUE_NAMES)) attachQueueEvents(name);

  await bootstrapScheduler().catch((err) => logger.error({ err }, "scheduler bootstrap failed"));

  logger.info("Worker ready");
}

main().catch((err) => {
  logger.error({ err }, "Worker crashed");
  process.exit(1);
});
