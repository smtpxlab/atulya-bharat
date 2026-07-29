import pino from "pino";
import { env, isProd } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: env.APP_NAME },
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
      },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.refreshToken",
      "*.accessToken",
    ],
    remove: true,
  },
});

export type Logger = typeof logger;
