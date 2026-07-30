import knex, { Knex } from "knex";
import pg from "pg";
import { env } from "./env";
import { logger } from "./logger";

/**
 * node-postgres returns numeric/bigint as strings, while PostgREST (the API the
 * React app was written against) returns them as JSON numbers. Parse them back
 * to numbers so UI code doing arithmetic / `toFixed` keeps working.
 */
pg.types.setTypeParser(1700, (v: string) => (v === null ? null : Number(v))); // numeric
pg.types.setTypeParser(20, (v: string) => (v === null ? null : Number(v))); // int8

let instance: Knex | null = null;

export function getDb(): Knex {
  if (instance) return instance;
  if (!env.DATABASE_URL) {
    logger.warn("DATABASE_URL is empty — DB client not initialized");
  }
  instance = knex({
    client: "pg",
    connection: env.DATABASE_URL
      ? {
          connectionString: env.DATABASE_URL,
          ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
        }
      : undefined,
    pool: { min: env.DATABASE_POOL_MIN, max: env.DATABASE_POOL_MAX },
    acquireConnectionTimeout: 10_000,
  });
  return instance;
}

export async function pingDb(): Promise<boolean> {
  try {
    if (!env.DATABASE_URL) return false;
    await getDb().raw("select 1");
    return true;
  } catch (err) {
    logger.error({ err }, "DB ping failed");
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
