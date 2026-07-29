import IORedis, { Redis } from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (client) return client;
  if (!env.REDIS_URL) {
    logger.warn("REDIS_URL is empty — Redis client not initialized");
    return null;
  }
  client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on("error", (err) => logger.error({ err }, "Redis error"));
  client.on("connect", () => logger.info("Redis connected"));
  return client;
}

export async function pingRedis(): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    const res = await r.ping();
    return res === "PONG";
  } catch (err) {
    logger.error({ err }, "Redis ping failed");
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
