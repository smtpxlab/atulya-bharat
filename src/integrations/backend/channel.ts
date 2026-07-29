import { BACKEND_URL } from "./config";
import { sessionStore } from "./http";

/**
 * Minimal Supabase Realtime compatibility layer over a native WebSocket. The
 * subset covers the usages in the current codebase:
 *
 *   supabase.channel(name).on(event, filter, cb).subscribe()
 *   channel.send({ type, event, payload })
 *   supabase.removeChannel(channel)
 *
 * The backend endpoint is expected at `${BACKEND_URL}/realtime` and to accept a
 * bearer token via the `?token=` query string. When realtime is not configured
 * the channel remains inert (subscribe returns "CHANNEL_ERROR").
 */

type Handler = { event: string; filter: any; cb: (payload: any) => void };

let socket: WebSocket | null = null;
const pending: Array<() => void> = [];
const eventDispatch = new Map<string, Set<(p: any) => void>>();

function wsUrl() {
  const url = new URL("/realtime", BACKEND_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const token = sessionStore.get()?.access_token;
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

function ensureSocket(): WebSocket | null {
  if (typeof WebSocket === "undefined") return null;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket;
  }
  try {
    socket = new WebSocket(wsUrl());
  } catch {
    socket = null;
    return null;
  }
  socket.addEventListener("open", () => {
    while (pending.length) pending.shift()!();
  });
  socket.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      const key = `${msg.channel}:${msg.event}`;
      eventDispatch.get(key)?.forEach((cb) => cb(msg.payload));
    } catch {
      /* ignore malformed frames */
    }
  });
  socket.addEventListener("close", () => {
    socket = null;
  });
  return socket;
}

function sendWhenReady(payload: unknown) {
  const s = ensureSocket();
  if (!s) return;
  const frame = JSON.stringify(payload);
  if (s.readyState === WebSocket.OPEN) s.send(frame);
  else pending.push(() => s.send(frame));
}

export function createChannel(name: string) {
  const handlers: Handler[] = [];
  const disposers: Array<() => void> = [];
  let subscribed = false;

  const channel = {
    _name: name,
    on(event: string, filter: any, cb?: (payload: any) => void) {
      const handler = typeof filter === "function" ? filter : cb!;
      handlers.push({ event, filter: typeof filter === "function" ? {} : filter, cb: handler });
      return channel;
    },
    subscribe(cb?: (status: string) => void) {
      const s = ensureSocket();
      if (!s) {
        cb?.("CHANNEL_ERROR");
        return channel;
      }
      handlers.forEach((h) => {
        const key = `${name}:${h.event}`;
        const set = eventDispatch.get(key) ?? new Set();
        set.add(h.cb);
        eventDispatch.set(key, set);
        disposers.push(() => set.delete(h.cb));
      });
      sendWhenReady({ type: "subscribe", channel: name, filters: handlers.map((h) => ({ event: h.event, filter: h.filter })) });
      subscribed = true;
      cb?.("SUBSCRIBED");
      return channel;
    },
    send(msg: { type: string; event: string; payload?: unknown }) {
      sendWhenReady({ type: "message", channel: name, ...msg });
      return channel;
    },
    unsubscribe() {
      if (!subscribed) return Promise.resolve("ok");
      disposers.splice(0).forEach((fn) => fn());
      sendWhenReady({ type: "unsubscribe", channel: name });
      subscribed = false;
      return Promise.resolve("ok");
    },
  };
  return channel;
}

export type CompatChannel = ReturnType<typeof createChannel>;

export function removeChannel(ch: CompatChannel) {
  return ch.unsubscribe();
}
