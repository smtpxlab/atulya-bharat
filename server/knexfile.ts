import type { Knex } from "knex";
import { env } from "./src/config/env";

const config: Record<string, Knex.Config> = {
  development: {
    client: "pg",
    connection: {
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    },
    pool: { min: env.DATABASE_POOL_MIN, max: env.DATABASE_POOL_MAX },
    migrations: { directory: "./src/models/migrations", extension: "ts" },
    seeds: { directory: "./src/models/seeds", extension: "ts" },
  },
  production: {
    client: "pg",
    connection: {
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    },
    pool: { min: env.DATABASE_POOL_MIN, max: env.DATABASE_POOL_MAX },
    migrations: { directory: "./dist/models/migrations" },
    seeds: { directory: "./dist/models/seeds" },
  },
};

export default config;
