import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Test the compatibility layer in isolation from the real Supabase client. All
// network calls are stubbed via a fetch mock so the tests can run without the
// Express backend being live.

const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0));

function mockFetch(responder: (input: RequestInfo | URL, init?: RequestInit) => any) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await responder(input, init);
    if (res instanceof Response) return res;
    return new Response(JSON.stringify(res.body ?? {}), {
      status: res.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("compat: feature flag", () => {
  it("defaults to disabled", async () => {
    const { BACKEND_ENABLED } = await import("../config");
    expect(BACKEND_ENABLED).toBe(false);
  });
});

describe("compat: auth", () => {
  it("signInWithPassword persists session and reports it", async () => {
    mockFetch(() => ({
      body: {
        access_token: "tok",
        refresh_token: "ref",
        user: { id: "u1", email: "a@b.com" },
      },
    }));
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const res = await client.auth.signInWithPassword({ email: "a@b.com", password: "x" });
    expect(res.error).toBeNull();
    expect(res.data?.session?.access_token).toBe("tok");
    const cur = await client.auth.getSession();
    expect(cur.data.session?.access_token).toBe("tok");
  });

  it("signOut clears the session", async () => {
    mockFetch(() => ({ body: {} }));
    const { sessionStore } = await import("../http");
    sessionStore.set({ access_token: "t" });
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    await client.auth.signOut();
    expect((await client.auth.getSession()).data.session).toBeNull();
  });

  it("onAuthStateChange fires with initial session", async () => {
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const cb = vi.fn();
    client.auth.onAuthStateChange(cb);
    await flushMicrotasks();
    expect(cb).toHaveBeenCalledWith("INITIAL_SESSION", null);
  });
});

describe("compat: from()", () => {
  it("builds select with eq/order/limit", async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    mockFetch((input, init) => {
      captured.url = String(input);
      captured.init = init;
      return { body: [{ id: 1 }, { id: 2 }] };
    });
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const res: any = await client.from("profiles").select("*").eq("id", "u1").order("created_at", { ascending: false }).limit(10);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(2);
    expect(captured.url).toContain("/tables/profiles");
    expect(captured.url).toContain("id.eq=u1");
    expect(captured.url).toContain("order=created_at");
    expect(captured.url).toContain("direction=desc");
    expect(captured.url).toContain("limit=10");
  });

  it("insert issues POST with body", async () => {
    const captured: { init?: RequestInit } = {};
    mockFetch((_input, init) => {
      captured.init = init;
      return { body: [{ id: 1 }] };
    });
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const res: any = await client.from("blogs").insert({ title: "x" });
    expect(res.error).toBeNull();
    expect(captured.init?.method).toBe("POST");
    expect(JSON.parse(String(captured.init?.body))).toEqual({ title: "x" });
  });

  it("single() unwraps to first row", async () => {
    mockFetch(() => ({ body: [{ id: "u1" }] }));
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const res: any = await client.from("profiles").select("*").eq("id", "u1").single();
    expect(res.data).toEqual({ id: "u1" });
  });

  it("propagates HTTP errors as {error}", async () => {
    mockFetch(() => new Response(JSON.stringify({ message: "boom" }), { status: 500, headers: { "content-type": "application/json" } }));
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const res: any = await client.from("profiles").select("*");
    expect(res.data).toBeNull();
    expect(res.error?.message).toBe("boom");
  });
});

describe("compat: rpc()", () => {
  it("invokes /rpc/:name with args", async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    mockFetch((input, init) => {
      captured.url = String(input);
      captured.init = init;
      return { body: { ok: true } };
    });
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const res = await client.rpc("challenge_leaderboard", { challenge_id: "c1" });
    expect(res.error).toBeNull();
    expect(captured.url).toContain("/rpc/challenge_leaderboard");
    expect(captured.init?.method).toBe("POST");
  });
});

describe("compat: storage()", () => {
  it("upload posts multipart", async () => {
    const captured: { init?: RequestInit } = {};
    mockFetch((_i, init) => {
      captured.init = init;
      return { body: { path: "avatars/x.png" } };
    });
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const res = await client.storage.from("avatars").upload("x.png", new Blob(["hi"]));
    expect(res.error).toBeNull();
    expect(captured.init?.body).toBeInstanceOf(FormData);
  });

  it("getPublicUrl composes bucket + path", async () => {
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const { data } = client.storage.from("avatars").getPublicUrl("u1.png");
    expect(data.publicUrl).toContain("/storage/public/avatars/u1.png");
  });
});

describe("compat: functions()", () => {
  it("invoke calls /functions/:name", async () => {
    const captured: { url?: string } = {};
    mockFetch((input) => {
      captured.url = String(input);
      return { body: { ok: true } };
    });
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const res = await client.functions.invoke("send-email", { body: { to: "a@b.com" } });
    expect(res.error).toBeNull();
    expect(captured.url).toContain("/functions/send-email");
  });
});

describe("compat: channel()", () => {
  it("returns a channel with subscribe/unsubscribe", async () => {
    const { createBackendClient } = await import("../client");
    const client = createBackendClient();
    const ch = client.channel("room:1");
    let status = "";
    ch.on("postgres_changes", { event: "INSERT" }, () => {}).subscribe((s) => (status = s));
    // WebSocket may or may not be available in the test env; either way this
    // must not throw and must return a channel object.
    expect(["SUBSCRIBED", "CHANNEL_ERROR"]).toContain(status);
    const removed = await client.removeChannel(ch);
    expect(removed).toBe("ok");
  });
});
