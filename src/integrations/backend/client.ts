import { createAuthClient } from "./auth";
import { createFromBuilder } from "./from";
import { rpc } from "./rpc";
import { createStorageClient } from "./storage";
import { createFunctionsClient } from "./functions";
import { createChannel, removeChannel, type CompatChannel } from "./channel";

/**
 * Supabase-shaped client that routes to the Express backend. Consumed only when
 * VITE_BACKEND_ENABLED === 'true'. Signatures intentionally mirror
 * @supabase/supabase-js so existing React components need no modifications.
 */
export function createBackendClient() {
  const auth = createAuthClient();
  const storage = createStorageClient();
  const functions = createFunctionsClient();

  return {
    auth,
    from: (table: string) => createFromBuilder(table),
    rpc: (fn: string, args: Record<string, unknown> = {}) => rpc(fn, args),
    storage,
    functions,
    channel: (name: string) => createChannel(name),
    removeChannel: (ch: CompatChannel) => removeChannel(ch),
    // Realtime helpers used sparingly in the codebase:
    getChannels: () => [],
  };
}

export type BackendCompatClient = ReturnType<typeof createBackendClient>;
