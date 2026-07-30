// Feature flag & runtime config for the Express backend compatibility layer.
// IMPORTANT: When VITE_BACKEND_ENABLED is not "true", the real Supabase client
// is used by consumers via src/integrations/backend/index.ts. This module
// intentionally does NOT modify src/integrations/supabase/client.ts.

export const BACKEND_ENABLED =
  String(import.meta.env.VITE_BACKEND_ENABLED ?? "false").toLowerCase() === "true";

const RAW_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();

/**
 * Empty / missing VITE_BACKEND_URL means "same origin" (single-service deploy).
 * Falling back to "" would make `new URL(path, "")` throw
 * "Failed to construct 'URL': Invalid base URL".
 */
export const BACKEND_URL =
  RAW_BACKEND_URL && RAW_BACKEND_URL.length > 0
    ? RAW_BACKEND_URL.replace(/\/+$/, "")
    : typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:8080";

export const BACKEND_API_PREFIX =
  (import.meta.env.VITE_BACKEND_API_PREFIX as string | undefined) ?? "/api/v1";

/**
 * Only a "there is probably a refresh cookie" hint is persisted — never a
 * token. The refresh token lives in an HTTP-only cookie and the access token
 * lives in memory only.
 */
export const SESSION_HINT_KEY = "abr.session.hint";
