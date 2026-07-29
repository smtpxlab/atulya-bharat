import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded, try later." },
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Too many auth attempts, try later." },
  },
});
