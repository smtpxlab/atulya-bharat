import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import { authReducer } from "./slices/authSlice";
import { uiReducer } from "./slices/uiSlice";
import { adminReducer } from "./slices/adminSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    admin: adminReducer,
  },
  middleware: (getDefault) =>
    // Auth slice stores Supabase Session/User objects, which contain non-serializable Date fields.
    getDefault({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
