/**
 * Legacy import path. The canonical client lives in
 * `@/integrations/supabase/client`. This file is kept as a thin
 * re-export to avoid creating a second GoTrueClient instance.
 */
export { supabase } from "@/integrations/supabase/client";

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
