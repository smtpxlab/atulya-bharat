/**
 * Runtime switch between the generated Supabase client and the Express
 * backend compatibility client.
 *
 * Vite aliases the specifier "@/integrations/supabase/client" to this file, so
 * every existing import in the app automatically routes to the Express backend
 * when VITE_BACKEND_ENABLED=true — without editing the auto-generated client.
 *
 * The relative "./client" import below is NOT aliased, so it always resolves to
 * the real generated Supabase client.
 */
import { supabase as realSupabase } from "./client";
import { BACKEND_ENABLED } from "@/integrations/backend/config";
import { createBackendClient } from "@/integrations/backend/client";

export const supabase = BACKEND_ENABLED
  ? (createBackendClient() as unknown as typeof realSupabase)
  : realSupabase;

export default supabase;
