import { monitoring } from "@/lib/monitoring";

export class ServiceError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    opts: { code?: string; cause?: unknown; context?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "ServiceError";
    this.code = opts.code ?? "service_error";
    this.cause = opts.cause;
    this.context = opts.context;
    // Report once, at the boundary where it's thrown.
    monitoring.captureError(this, { code: this.code, ...opts.context });
  }
}

/**
 * Detect Postgres / PostgREST errors that mean "the caller is not authenticated
 * (or their session expired)". Used to translate raw RLS failures into a
 * friendly "please sign in" UX instead of leaking SQL error text.
 */
export const isAuthRequiredError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; status?: number };
  if (e.status === 401) return true;
  if (e.code === "PGRST301" || e.code === "auth_required") return true;
  const msg = (e.message ?? "").toLowerCase();
  // Only treat 42501 as auth-required when the RPC explicitly raised "auth required".
  // Business validation errors (e.g. "registration not active", "registration not found")
  // also use 42501/P0001 — surface their real text instead of forcing a login redirect.
  if (e.code === "42501" && msg.includes("auth required")) return true;
  return (
    msg.includes("jwt expired") ||
    msg.includes("jwt is expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("missing authorization")
  );
};

/** Wrap a Supabase / unknown error into a normalized ServiceError. */
export const toServiceError = (
  err: unknown,
  fallback = "Something went wrong",
  context?: Record<string, unknown>,
): ServiceError => {
  if (err instanceof ServiceError) return err;
  const raw = err as { message?: string; code?: string } | null;
  const message = raw?.message?.trim() || fallback;
  const code = isAuthRequiredError(err)
    ? "auth_required"
    : raw?.code ?? "service_error";
  return new ServiceError(message, { code, cause: err, context });
};
