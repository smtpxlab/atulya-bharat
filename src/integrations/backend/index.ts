/**
 * Entry point for the Supabase → Express compatibility layer.
 *
 * Behavior is governed by VITE_BACKEND_ENABLED:
 *   - false (default): re-exports the real Supabase client unchanged so
 *     production traffic and every existing React component keep working.
 *   - true: exports a Supabase-shaped client that routes to the Express
 *     backend implemented in phases 2–7.
 *
 * NOTE: The auto-generated file src/integrations/supabase/client.ts is NOT
 * modified. To flip traffic in a later phase, update the imports of
 * consuming components (or add a re-export shim) rather than editing the
 * generated file.
 */
import { supabase as realSupabase } from "@/integrations/supabase/client";
import { BACKEND_ENABLED } from "./config";
import { createBackendClient } from "./client";

export const supabase = BACKEND_ENABLED
  ? (createBackendClient() as unknown as typeof realSupabase)
  : realSupabase;

export { BACKEND_ENABLED } from "./config";
export { createBackendClient } from "./client";
