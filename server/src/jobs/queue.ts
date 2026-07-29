import { Queue, QueueEvents, Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

/** Named queues used across the platform. Populated in later phases. */
export const QUEUE_NAMES = {
  email: "email",
  stravaSync: "strava-sync",
  notifications: "notifications",
  webhooks: "webhooks",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

function makeConnection() {
  if (!env.REDIS_URL) return null;
  // BullMQ requires a dedicated connection with maxRetriesPerRequest = null.
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue | null {
  if (queues.has(name)) return queues.get(name)!;
  const connection = makeConnection();
  if (!connection) {
    logger.warn({ name }, "Redis not configured — queue disabled");
    return null;
  }
  const q = new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
  queues.set(name, q);
  return q;
}

export async function enqueue<T>(name: QueueName, jobName: string, data: T, opts?: JobsOptions) {
  const q = getQueue(name);
  if (!q) throw new Error("Queue unavailable (no Redis)");
  return q.add(jobName, data, opts);
}

/** Register a worker. Handlers land here in later phases. */
export function registerWorker<T>(
  name: QueueName,
  handler: (job: { name: string; data: T }) => Promise<unknown>,
): Worker | null {
  const connection = makeConnection();
  if (!connection) return null;
  const w = new Worker<T>(name, async (job) => handler({ name: job.name, data: job.data }), {
    connection,
    concurrency: 5,
  });
  w.on("failed", (job, err) => logger.error({ name, jobId: job?.id, err }, "job failed"));
  return w;
}

export function attachQueueEvents(name: QueueName) {
  const connection = makeConnection();
  if (!connection) return null;
  const qe = new QueueEvents(name, { connection });
  qe.on("completed", ({ jobId }) => logger.debug({ name, jobId }, "job completed"));
  qe.on("failed", ({ jobId, failedReason }) =>
    logger.warn({ name, jobId, failedReason }, "job failed event"),
  );
  return qe;
}
