import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { GuardianProvider } from "./context/GuardianContext";
import "./styles/theme.css";

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).catch(() => undefined);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 45_000, retry: shouldRetryQuery, retryDelay: queryRetryDelay, refetchOnWindowFocus: true },
    mutations: { retry: false }
  }
});

function shouldRetryQuery(attempt: number, error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  const status = typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: unknown }).status
    : undefined;
  return status !== 401 && attempt < 3;
}

function queryRetryDelay(attempt: number, error: unknown): number {
  const retryAfterSeconds = typeof error === "object" && error !== null && "retryAfterSeconds" in error
    ? Number((error as { retryAfterSeconds?: unknown }).retryAfterSeconds || 0)
    : 0;
  return retryAfterSeconds > 0 ? Math.min(retryAfterSeconds * 1_000, 70_000) : Math.min(1_000 * 2 ** attempt, 10_000);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {window.location.pathname.replace(/\/$/, "") === "/support" ? <App /> : <GuardianProvider><App /></GuardianProvider>}
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
