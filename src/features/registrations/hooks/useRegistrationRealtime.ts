import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { registrationKeys } from "./useRegistrationDetail";

/**
 * Live-invalidate the cached registration detail and dashboard queries whenever
 * the registration row or any activity_log tied to it changes server-side.
 */
export function useRegistrationRealtime(registrationId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!registrationId) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: registrationKeys.detail(registrationId) });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["registrations"] });
    };
    const channel = supabase
      .channel(`registration-rt-${registrationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registrations", filter: `id=eq.${registrationId}` },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_logs",
          filter: `registration_id=eq.${registrationId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_milestones",
          filter: `registration_id=eq.${registrationId}`,
        },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [registrationId, qc]);
}
