import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import { env, corsOrigins } from "./config/env";
import { openApiSpec } from "./config/swagger";
import { requestLogger } from "./middleware/requestLogger";
import { globalRateLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import routes from "./routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Security & platform middleware
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: corsOrigins.length && !corsOrigins.includes("*") ? corsOrigins : true,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // Observability
  app.use(requestLogger);

  // Rate limiting
  app.use(globalRateLimiter);

  // API
  const base = `/api/${env.API_VERSION}`;
  app.use(base, routes);

  // Docs
  app.use(
    `${base}/docs`,
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, { customSiteTitle: "Atulya Bharat Run API" }),
  );
  app.get(`${base}/openapi.json`, (_req, res) => res.json(openApiSpec));

  // Root convenience
  app.get("/", (_req, res) =>
    res.json({ name: env.APP_NAME, api: base, docs: `${base}/docs`, health: `${base}/health` }),
  );

  // 404 + errors
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
