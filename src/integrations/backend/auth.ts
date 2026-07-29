import {
  request,
  refreshSession,
  sessionStore,
  type BackendSession,
} from "./http";

// Matches @supabase/supabase-js return shape: { data, error }
type Result<T> = { data: T; error: null } | { data: null; error: { message: string; status?: number } };

function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  return fn().then(
    (data) => ({ data, error: null }),
    (err) => ({ data: null, error: { message: err?.message ?? "Unknown error", status: err?.status } }),
  );
}

/**
 * The API returns `{ user, accessToken, sessionId }`. There is deliberately no
 * refresh token in the body for browser clients — it is set as an HTTP-only
 * cookie by the server.
 */
function normalizeSession(raw: any): BackendSession | null {
  if (!raw) return null;
  const token = raw.accessToken ?? raw.access_token ?? raw.session?.access_token;
  if (!token) return null;
  return {
    access_token: token,
    session_id: raw.sessionId ?? raw.session_id,
    user: raw.user ?? raw.session?.user,
  };
}

type AuthListener = (event: string, session: BackendSession | null) => void;

export function createAuthClient() {
  return {
    async getSession() {
      let session = sessionStore.get();
      // On a cold page load the access token is gone (memory-only) but the
      // refresh cookie may still be valid — recover it silently.
      if (!session && sessionStore.hasPersistedSession()) {
        session = await refreshSession();
      }
      return { data: { session }, error: null };
    },

    async getUser() {
      const session = sessionStore.get();
      if (!session) return { data: { user: null }, error: null };
      return wrap(async () => {
        const user = await request<any>({ path: "/auth/me" });
        return { user };
      }).then((r) => (r.error ? { data: { user: null }, error: r.error } : r)) as any;
    },

    async signInWithPassword(credentials: {
      email: string;
      password: string;
      /** "Remember me" — long-lived refresh cookie instead of a session one. */
      remember?: boolean;
    }) {
      return wrap(async () => {
        const res = await request<any>({
          method: "POST",
          path: "/auth/login",
          body: {
            email: credentials.email,
            password: credentials.password,
            remember: credentials.remember ?? false,
          },
          auth: false,
        });
        const session = normalizeSession(res);
        sessionStore.set(session);
        return { user: session?.user ?? null, session };
      });
    },

    async signUp(payload: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }) {
      return wrap(async () => {
        const res = await request<any>({
          method: "POST",
          path: "/auth/register",
          body: {
            email: payload.email,
            password: payload.password,
            fullName: payload.options?.data?.full_name as string | undefined,
          },
          auth: false,
        });
        const session = normalizeSession(res);
        if (session) sessionStore.set(session);
        return { user: session?.user ?? res.user ?? null, session };
      });
    },

    async signOut(opts?: { scope?: "local" | "global" }) {
      return wrap(async () => {
        try {
          await request({
            method: "POST",
            path: "/auth/logout",
            body: { allDevices: opts?.scope === "global" },
          });
        } finally {
          sessionStore.set(null);
        }
        return {};
      });
    },

    async refreshSession() {
      return wrap(async () => {
        const session = await refreshSession();
        if (!session) throw new Error("Session expired. Please sign in again.");
        return { session, user: session.user ?? null };
      });
    },

    async resetPasswordForEmail(email: string) {
      return wrap(async () => {
        await request({
          method: "POST",
          path: "/auth/forgot-password",
          body: { email },
          auth: false,
        });
        return {};
      });
    },

    /** Password change for a signed-in user, or token-based reset completion. */
    async updateUser(attrs: {
      password?: string;
      currentPassword?: string;
      [key: string]: unknown;
    }) {
      return wrap(async () => {
        if (attrs.password && attrs.currentPassword) {
          await request({
            method: "POST",
            path: "/auth/change-password",
            body: { currentPassword: attrs.currentPassword, newPassword: attrs.password },
          });
          // Every session was revoked server-side — force a clean re-login.
          sessionStore.set(null);
          return { user: null };
        }
        const res = await request<{ user: any }>({
          method: "PATCH",
          path: "/profiles/me",
          body: attrs,
        });
        return { user: res.user };
      });
    },

    /* ── session / device management (no Supabase equivalent) ───────────── */

    listSessions: () => wrap(() => request<any[]>({ path: "/auth/sessions" })),
    revokeSession: (id: string) =>
      wrap(() => request({ method: "DELETE", path: `/auth/sessions/${id}` })),
    revokeAllSessions: () => wrap(() => request({ method: "DELETE", path: "/auth/sessions" })),
    listDevices: () => wrap(() => request<any[]>({ path: "/auth/devices" })),
    removeDevice: (id: string) =>
      wrap(() => request({ method: "DELETE", path: `/auth/devices/${id}` })),
    loginHistory: (limit = 50) =>
      wrap(() => request<any[]>({ path: "/auth/login-history", query: { limit } })),

    onAuthStateChange(cb: AuthListener) {
      const unsub = sessionStore.subscribe((s) => cb(s ? "SIGNED_IN" : "SIGNED_OUT", s));
      // Fire once with current state to mirror Supabase behavior, recovering
      // the session from the refresh cookie when possible.
      queueMicrotask(async () => {
        const current = sessionStore.get();
        if (!current && sessionStore.hasPersistedSession()) {
          const recovered = await refreshSession();
          cb("INITIAL_SESSION", recovered);
          return;
        }
        cb("INITIAL_SESSION", current);
      });
      return { data: { subscription: { unsubscribe: unsub } } };
    },
  };
}
