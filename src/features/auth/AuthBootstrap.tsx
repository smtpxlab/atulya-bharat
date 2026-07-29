import { useEffect, useRef } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monitoring } from "@/lib/monitoring";
import { useAppDispatch } from "@/store";
import {
  AppRole,
  rolesLoaded,
  rolesLoading,
  sessionLoaded,
  signedOut,
} from "@/store/slices/authSlice";

/** Top-level query-key prefixes that hold per-user data. */
const AUTH_KEY_PREFIXES = new Set([
  "user",
  "profile",
  "dashboard",
  "registrations",
  "addresses",
  "admin-profile",
]);

const isAuthScopedQuery = (query: Query) => {
  if (query.meta?.requiresAuth === true) return true;
  const key = query.queryKey;
  if (Array.isArray(key) && typeof key[0] === "string") {
    return AUTH_KEY_PREFIXES.has(key[0]);
  }
  return false;
};

/**
 * Single bootstrap that hydrates Redux `auth` slice from Supabase.
 * Mount exactly once near the router.
 */
export function AuthBootstrap() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const loadedForUserId = useRef<string | null>(null);
  const bootstrapStartedAt = useRef<number>(Date.now());
  const initializedReported = useRef(false);

  useEffect(() => {
    monitoring.track("auth_bootstrap_started");

    const reportInitialized = () => {
      if (initializedReported.current) return;
      initializedReported.current = true;
      monitoring.track("auth_bootstrap_completed", {
        time_to_initialized_ms: Date.now() - bootstrapStartedAt.current,
      });
    };

    const fetchRoles = async (userId: string) => {
      dispatch(rolesLoading());
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) {
        dispatch(rolesLoaded([]));
        return;
      }
      dispatch(rolesLoaded((data ?? []).map((r) => r.role as AppRole)));
      loadedForUserId.current = userId;
    };

    // Subscribe FIRST so we never miss an event.
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      dispatch(sessionLoaded({ session: newSession }));
      reportInitialized();
      const uid = newSession?.user?.id ?? null;
      if (uid) {
        monitoring.identify(uid, { email: newSession!.user.email });
        if (loadedForUserId.current !== uid) {
          setTimeout(() => void fetchRoles(uid), 0);
        }
      } else {
        monitoring.identify(null);
        loadedForUserId.current = null;
        if (event === "SIGNED_OUT") {
          dispatch(signedOut());
          // Targeted cache cleanup — preserves public caches (challenges, clubs,
          // blog, gallery, leaderboard, CMS pages).
          queryClient.removeQueries({ predicate: isAuthScopedQuery });
          monitoring.track("logout_completed");
        }
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      dispatch(sessionLoaded({ session: data.session }));
      reportInitialized();
      const uid = data.session?.user?.id ?? null;
      if (uid && loadedForUserId.current !== uid) void fetchRoles(uid);
    });

    return () => sub.subscription.unsubscribe();
  }, [dispatch, queryClient]);

  return null;
}
