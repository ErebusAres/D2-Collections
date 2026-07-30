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
import { registerGuardianServiceWorker } from "./services/registerServiceWorker";
import destinationAtmospheresUrl from "./styles/destination-atmospheres.css?url";
import { ensureStylesheet } from "./styles/loadStylesheet";
import "./styles/theme.css";

ensureStylesheet("destination-atmospheres", destinationAtmospheresUrl);

registerGuardianServiceWorker();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 45_000, retry: shouldRetryQuery, refetchOnWindowFocus: true },
    mutations: { retry: false }
  }
});

function shouldRetryQuery(attempt: number, error: unknown): boolean {
  const status = typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: unknown }).status
    : undefined;
  return status !== 401 && attempt < 2;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GuardianProvider>
          <App />
        </GuardianProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
