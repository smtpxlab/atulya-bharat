/**
 * Monitoring wrapper. No external SDK is wired in this phase — the methods
 * are no-ops in production and `console`-logged in development. When the
 * project picks Sentry / PostHog / Plausible, the only file that needs to
 * change is this one.
 */
const isDev = import.meta.env.DEV;

type Ctx = Record<string, unknown> | undefined;

class Monitoring {
  private initialized = false;
  private userId: string | null = null;

  init() {
    if (this.initialized) return;
    this.initialized = true;
    if (isDev) console.info("[monitoring] initialized (no-op)");
  }

  identify(userId: string | null, traits?: Ctx) {
    this.userId = userId;
    if (isDev) console.info("[monitoring] identify", userId, traits);
  }

  captureError(error: unknown, context?: Ctx) {
    const payload = { user: this.userId, ...context };
    if (isDev) console.error("[monitoring] error", error, payload);
  }

  captureMessage(message: string, context?: Ctx) {
    if (isDev) console.warn("[monitoring] message", message, context);
  }

  trackEvent(name: string, props?: Ctx) {
    if (isDev) console.info("[monitoring] event", name, props);
  }

  /** Shorthand alias used by the auth telemetry. */
  track(name: string, props?: Ctx) {
    this.trackEvent(name, props);
  }
}

export const monitoring = new Monitoring();
