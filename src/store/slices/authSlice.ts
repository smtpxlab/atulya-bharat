import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole =
  | "user"
  | "admin"
  | "club_owner"
  | "content_manager"
  | "super_admin";

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;       // initial session bootstrap in flight
  rolesLoading: boolean;  // roles for the current user in flight
  initialized: boolean;   // session state is KNOWN (signed-in or signed-out)
};

const initialState: AuthState = {
  user: null,
  session: null,
  roles: [],
  loading: true,
  rolesLoading: true,
  initialized: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionLoaded(
      state,
      action: PayloadAction<{ session: Session | null }>,
    ) {
      const next = action.payload.session;
      const prevToken = state.session?.access_token ?? null;
      const nextToken = next?.access_token ?? null;
      const prevUid = state.user?.id ?? null;
      const nextUid = next?.user?.id ?? null;

      // Always flip bootstrap flags.
      state.loading = false;
      state.initialized = true;

      // No-op when session is effectively unchanged. Preserves object identity
      // across TOKEN_REFRESHED so useAuth consumers don't re-render.
      if (prevToken === nextToken && prevUid === nextUid) {
        if (!nextUid) state.rolesLoading = false;
        return;
      }

      state.session = next;
      state.user = next?.user ?? null;
      if (!state.user) {
        state.roles = [];
        state.rolesLoading = false;
      }
    },
    rolesLoading(state) {
      state.rolesLoading = true;
    },
    rolesLoaded(state, action: PayloadAction<AppRole[]>) {
      state.roles = action.payload;
      state.rolesLoading = false;
    },
    signedOut(state) {
      state.user = null;
      state.session = null;
      state.roles = [];
      state.loading = false;
      state.rolesLoading = false;
      state.initialized = true;
    },
  },
});

export const { sessionLoaded, rolesLoading, rolesLoaded, signedOut } =
  authSlice.actions;
export const authReducer = authSlice.reducer;
