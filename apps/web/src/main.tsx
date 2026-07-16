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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 45_000, retry: (attempt, error: any) => error?.status !== 401 && attempt < 2, refetchOnWindowFocus: true },
    mutations: { retry: false }
  }
});

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
