import "dotenv/config";
import { z } from "zod";

const bool = z
  .string()
  .transform((v) => v === "true" || v === "1")
  .pipe(z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8000),
  APP_NAME: z.string().default("atulya-bharat-run-api"),
  API_VERSION: z.string().default("v1"),
  LOG_LEVEL: z.string().default("info"),

  CORS_ORIGINS: z.string().default("*"),

  DATABASE_URL: z.string().default(""),
  DATABASE_SSL: bool.default("true" as unknown as string).or(z.boolean()).default(true),
  DATABASE_POOL_MIN: z.coerce.number().default(2),
  DATABASE_POOL_MAX: z.coerce.number().default(10),

  REDIS_URL: z.string().default(""),

  JWT_ACCESS_SECRET: z.string().default("dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  ARGON2_MEMORY_COST: z.coerce.number().default(19456),
  ARGON2_TIME_COST: z.coerce.number().default(2),
  ARGON2_PARALLELISM: z.coerce.number().default(1),
  COOKIE_SECRET: z.string().default("dev-cookie-secret"),

  // Refresh-cookie transport. Cross-origin (Lovable app ⇄ Railway API) needs
  // SameSite=None + Secure; same-origin deployments can use "lax".
  COOKIE_DOMAIN: z.string().default(""),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("none"),
  COOKIE_SECURE: z.coerce.boolean().default(true),
  /** "Remember me" refresh lifetime, in days. Short session otherwise. */
  REFRESH_REMEMBER_DAYS: z.coerce.number().default(30),
  REFRESH_SESSION_DAYS: z.coerce.number().default(1),
  /** Failed logins per email inside the window before a temporary lock. */
  LOGIN_LOCK_THRESHOLD: z.coerce.number().default(10),
  LOGIN_LOCK_MINUTES: z.coerce.number().default(15),


  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),

  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET: z.string().default(""),
  R2_PUBLIC_BASE_URL: z.string().default(""),

  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("no-reply@localhost"),

  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  STRAVA_CLIENT_ID: z.string().default(""),
  STRAVA_CLIENT_SECRET: z.string().default(""),
  STRAVA_VERIFY_TOKEN: z.string().default(""),
  STRAVA_REDIRECT_URI: z.string().default(""),

  PUBLIC_APP_URL: z.string().default("http://localhost:5173"),
  SUPPORT_EMAIL: z.string().default("support@atulyabharatrun.com"),
  CONTACT_RECEIVER: z.string().default(""),
  MAIL_FROM_NAME: z.string().default("Atulya Bharat Run"),
  SITE_URL: z.string().default("https://atulyabharatrun.com"),

  // Feature flags — keep background workers off until compatibility layer flips.
  ENABLE_SCHEDULER: z.coerce.boolean().default(false),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
