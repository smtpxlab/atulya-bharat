import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as ReduxProvider } from "react-redux";
import App from "./App.tsx";
import { store } from "./store";
import { monitoring } from "@/lib/monitoring";
import "./index.css";
import "@/components/editor/editorStyles.css";
import "nprogress/nprogress.css";
import "./styles/nprogress.css";

monitoring.init();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
      // v5 equivalent of keepPreviousData — preserves previous data during
      // refetches/route transitions to avoid flicker.
      placeholderData: (prev: unknown) => prev,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <ReduxProvider store={store}>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </HelmetProvider>
  </ReduxProvider>
);
