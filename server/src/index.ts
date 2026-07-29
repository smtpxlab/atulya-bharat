import http from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { initSocket } from "./socket";
import { closeDb } from "./config/db";
import { closeRedis } from "./config/redis";

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, api: `/api/${env.API_VERSION}` },
      "API listening",
    );
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(() => logger.info("HTTP server closed"));
    try {
      await Promise.allSettled([closeDb(), closeRedis()]);
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("unhandledRejection", (err) => logger.error({ err }, "unhandledRejection"));
  process.on("uncaughtException", (err) => logger.error({ err }, "uncaughtException"));
}

bootstrap().catch((err) => {
  logger.error({ err }, "Bootstrap failed");
  process.exit(1);
});
