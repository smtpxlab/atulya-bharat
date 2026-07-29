import { BACKEND_URL, BACKEND_API_PREFIX, SESSION_HINT_KEY } from "./config";

export interface BackendUser {
  id: string;
  email: string;
  emailVerified?: boolean;
  roles?: string[];
  [key: string]: unknown;
}

export interface BackendSession {
  access_token: string;
  expires_at?: number; // epoch seconds
  session_id?: string;
  user?: BackendUser;
}

type Listener = (session: BackendSession | null) => void;
const listeners = new Set<Listener>();

/**
 * Access tokens are held in memory only.
 *
 * The refresh token never touches JS — it lives in an HTTP-only cookie set by
 * the API, so an XSS payload cannot steal a long-lived credential. The only
 * thing persisted is a boolean-ish hint in localStorage telling the app
 * "a refresh cookie probably exists", so a page reload knows to attempt a
 * silent refresh instead of rendering a signed-out shell first.
 */
let memorySession: BackendSession | null = null;

function writeHint(hasSession: boolean) {
  try {
    if (hasSession) localStorage.setItem(SESSION_HINT_KEY, "1");
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* private mode / storage disabled */
  }
}

export const sessionStore = {
  get(): BackendSession | null {
    return memorySession;
  },
  set(session: BackendSession | null) {
    memorySession = session;
    writeHint(!!session);
    listeners.forEach((l) => l(session));
  },
  /** True when a refresh cookie is likely present (survives page reloads). */
  hasPersistedSession(): boolean {
    try {
      return localStorage.getItem(SESSION_HINT_KEY) === "1";
    } catch {
      return false;
    }
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Read the (non-HttpOnly) CSRF cookie for double-submit verification. */
export function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)abr_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface RequestOptions {
  method?: string;
  path: string;               // relative to API prefix, e.g. "/profiles"
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  raw?: boolean;              // return Response instead of parsed JSON
  auth?: boolean;             // attach bearer token (default true when present)
  /** Internal: prevents infinite refresh recursion. */
  _retry?: boolean;
}

function buildUrl(path: string, query?: Record<string, unknown>) {
  const url = new URL(
    (path.startsWith("/") ? path : `/${path}`).startsWith(BACKEND_API_PREFIX)
      ? path
      : `${BACKEND_API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`,
    BACKEND_URL,
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/* ── silent refresh, de-duplicated across concurrent 401s ─────────────────── */

let refreshInFlight: Promise<BackendSession | null> | null = null;

export function refreshSession(): Promise<BackendSession | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(readCsrfToken() ? { "X-CSRF-Token": readCsrfToken()! } : {}),
        },
        body: "{}",
        credentials: "include",
      });
      if (!res.ok) {
        sessionStore.set(null);
        return null;
      }
      const payload = await res.json();
      const session: BackendSession = {
        access_token: payload.accessToken,
        session_id: payload.sessionId,
        user: payload.user,
      };
      sessionStore.set(session);
      return session;
    } catch {
      sessionStore.set(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function request<T = any>(opts: RequestOptions): Promise<T> {
  const { method = "GET", path, query, body, headers = {}, raw, auth = true } = opts;
  const token = auth ? sessionStore.get()?.access_token : undefined;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders["Content-Type"] ??= "application/json";
  }
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;

  // Double-submit CSRF token for any cookie-authenticated mutation.
  if (method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") {
    const csrf = readCsrfToken();
    if (csrf) finalHeaders["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers: finalHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
        ? body
        : JSON.stringify(body),
    credentials: "include",
  });

  // Access token expired → refresh once via the cookie, then replay.
  if (res.status === 401 && auth && !opts._retry && !path.startsWith("/auth/refresh")) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>({ ...opts, _retry: true });
  }

  if (raw) return res as unknown as T;

  const ct = res.headers.get("content-type") ?? "";
  const payload = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const err: any = new Error(
      (payload && typeof payload === "object" && (payload.message || payload.error)) ||
        `Request failed (${res.status})`,
    );
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload as T;
}
