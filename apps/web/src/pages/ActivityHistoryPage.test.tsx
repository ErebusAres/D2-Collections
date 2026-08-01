// @vitest-environment jsdom

import type { ActivityHistoryData } from "@guardian-nexus/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../services/api/client";
import { ActivityHistoryPage } from "./ActivityHistoryPage";

vi.mock("../context/GuardianContext", () => ({ useGuardian: () => ({ session: { authenticated: true }, autoRefresh: false }) }));
vi.mock("../services/api/client", () => ({ api: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("activity history and onboarding", () => {
  it("renders Bungie rows, filters modes, and explains new-player account states", async () => {
    vi.mocked(api).mockResolvedValue({ data: history(), freshness: { state: "fresh", observedAt: "2026-08-01T12:00:00Z" }, warnings: [], requestId: "history-test" });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Test Strike" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Test Arena" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Start with a playable Guardian" })).toBeTruthy();
    expect(screen.getByText(/does not prove a usable physical copy/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "PVP" }));
    expect(screen.queryByRole("heading", { name: "Test Strike" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Test Arena" })).toBeTruthy();
  });
});

function renderPage() {
  return render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ActivityHistoryPage /></QueryClientProvider></MemoryRouter>);
}
function history(): ActivityHistoryData {
  const base = { characterId: "hunter", characterClass: "Hunter" as const, period: "2026-08-01T11:00:00Z", activityHash: "1", activityDescription: "A test activity.", completed: true, durationSeconds: 900 };
  return {
    manifestVersion: "v1", state: "available", returnedCharacters: 1, totalCharacters: 1,
    activities: [
      { ...base, instanceId: "pve", activityName: "Test Strike", kind: "pve", mode: 3, modeName: "Strike" },
      { ...base, instanceId: "pvp", activityName: "Test Arena", kind: "pvp", mode: 5, modeName: "Crucible", kills: 10 }
    ],
    sources: { activities: "Destiny2.GetActivityHistory for each current character", definitions: "DestinyActivityDefinition manifest data" }
  };
}
