// @vitest-environment jsdom
import type { AudienceDetailData } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../services/api/client";
import { AudiencePage } from "./AudiencePage";

vi.mock("../context/GuardianContext", () => ({ useGuardian: () => ({
  session: { authenticated: true, csrfToken: "csrf", guardian: { membershipId: "1000000000000000001" } },
  loading: false,
  signIn: vi.fn(),
  refresh: vi.fn()
}) }));
vi.mock("../services/api/client", () => ({ api: vi.fn(), mutationHeaders: vi.fn(() => ({ "X-CSRF-Token": "csrf" })) }));

afterEach(() => vi.clearAllMocks());

describe("Audience administrator sessions", () => {
  it("requires confirmation and invalidates every session for the selected Guardian", async () => {
    vi.mocked(api).mockImplementation(async (path, init) => {
      if (path === "/api/v1/audience/sessions") return { data: { membershipId: "2000000000000000002", invalidatedSessions: 2 }, freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: "delete" } as never;
      return { data: audience(), freshness: { state: "fresh", observedAt: "now" }, warnings: [], requestId: String(init?.method || "get") } as never;
    });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AudiencePage /></QueryClientProvider>);

    const force = await screen.findByRole("button", { name: "Force sign out" });
    fireEvent.click(force);
    expect(screen.getByRole("button", { name: "Confirm force sign out" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm force sign out" }));

    await waitFor(() => expect(vi.mocked(api)).toHaveBeenCalledWith("/api/v1/audience/sessions", expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ membershipId: "2000000000000000002" })
    })));
  });
});

function audience(): AudienceDetailData {
  return {
    uniqueVisitors: 2,
    uniqueLogins: 2,
    visitorsTrackingSince: "2026-08-01T00:00:00.000Z",
    visitors: [],
    logins: [
      { membershipId: "1000000000000000001", membershipType: 3, displayName: "Admin", bungieName: "Admin#0001", firstLoginAt: "2026-08-01T00:00:00.000Z", lastLoginAt: "2026-08-10T00:00:00.000Z", activeSessions: 1 },
      { membershipId: "2000000000000000002", membershipType: 3, displayName: "Guardian", bungieName: "Guardian#0002", firstLoginAt: "2026-08-01T00:00:00.000Z", lastLoginAt: "2026-08-10T00:00:00.000Z", activeSessions: 2 }
    ]
  };
}
