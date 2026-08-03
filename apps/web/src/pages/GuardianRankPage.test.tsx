// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GuardianRankData } from "@guardian-nexus/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api } from "../services/api/client";
import { GuardianRankPage } from "./GuardianRankPage";

const setPreference = vi.fn();
vi.mock("../context/GuardianContext", () => ({
  useGuardian: () => ({ session: { authenticated: true }, selectedCharacterId: "c1", autoRefresh: false, preferences: { "guardianRank.tracked": "[]" }, setPreference })
}));
vi.mock("../services/api/client", () => ({ api: vi.fn() }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Guardian Rank page", () => {
  it("keeps rank 7 selected while showing its progress toward rank 8", async () => {
    const response = envelope();
    response.data.currentRank = 7;
    response.data.renewedRank = 7;
    response.data.suggestedRank = 7;
    response.data.ranks[0]!.state = "previous";
    response.data.ranks[1]!.state = "current";
    response.data.ranks[2]!.state = "next";
    vi.mocked(api).mockResolvedValue(response);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Elite" })).toBeTruthy();
    expect(screen.getByText("Current rank · objectives unlock rank 8")).toBeTruthy();
    expect(screen.getByText("Progress to rank 8")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View rank 7: Elite" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens on the current rank quests, keeps future ranks available, and saves tracked objectives", async () => {
    vi.mocked(api).mockResolvedValue(envelope());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Veteran" })).toBeTruthy();
    expect(screen.getByText("Current / renewed rank")).toBeTruthy();
    expect(screen.getByText("Rank selector starts here")).toBeTruthy();
    expect(screen.getByText("Highest rank achieved")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /View rank 12/ })).toBeNull();
    expect(screen.getByRole("button", { name: "View rank 8: Justiciar" })).toBeTruthy();
    expect(screen.getByText("Site tracked")).toBeTruthy();
    expect(screen.getByText("Progress to rank 7")).toBeTruthy();
    expect(screen.getByText("Ascension")).toBeTruthy();
    const completedSectionButton = screen.getByRole("button", { name: "Expand Power" });
    expect(completedSectionButton.getAttribute("aria-expanded")).toBe("false");
    expect(completedSectionButton.getAttribute("aria-controls") && document.getElementById(completedSectionButton.getAttribute("aria-controls")!)?.hidden).toBe(true);
    fireEvent.click(completedSectionButton);
    expect(screen.getByText("Reach Power")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    const previousRank = screen.getByRole("button", { name: "View rank 6: Veteran" });
    expect(previousRank.textContent).not.toContain("6");

    fireEvent.click(screen.getByRole("button", { name: "View rank 7: Elite" }));
    expect(await screen.findByRole("heading", { name: "Elite" })).toBeTruthy();
    expect(screen.getByText("Progress to rank 8")).toBeTruthy();
    expect(screen.getByText("4 / 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Track Service" }));
    expect(setPreference).toHaveBeenCalledWith("guardianRank.tracked", JSON.stringify(["record7"]));

    fireEvent.click(previousRank);
    expect(await screen.findByRole("heading", { name: "Veteran" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View rank 8: Justiciar" }));
    expect(await screen.findByRole("heading", { name: "Justiciar" })).toBeTruthy();
    expect(screen.getByTestId("selected-rank-artwork").querySelector("img")?.getAttribute("src")).toBe("/eight.png");
    expect(screen.getByText("Progress to rank 9")).toBeTruthy();
  });

  it("collapses and expands all visible objective sections", async () => {
    vi.mocked(api).mockResolvedValue(envelope());
    renderPage();

    expect(await screen.findByRole("button", { name: "Expand Power" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByRole("button", { name: "Collapse Power" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Reach Power")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    const collapsedButton = screen.getByRole("button", { name: "Expand Power" });
    expect(collapsedButton.getAttribute("aria-expanded")).toBe("false");
    expect(collapsedButton.getAttribute("aria-controls") && document.getElementById(collapsedButton.getAttribute("aria-controls")!)?.hidden).toBe(true);
  });

  it("balances two smaller sections against one larger section", async () => {
    const response = envelope();
    const rank = response.data.ranks[0]!;
    const template = rank.categories[0]!.quests[0]!;
    const category = (nodeHash: string, name: string, questCount: number) => ({
      nodeHash, name, description: "", icon: "", seasonal: false, completed: 0, total: questCount,
      quests: Array.from({ length: questCount }, (_, index) => ({
        ...template,
        recordHash: `${nodeHash}-record-${index}`,
        name: `${name} objective ${index + 1}`,
        state: "in-progress" as const,
        objectives: template.objectives.map((objective) => ({ ...objective, objectiveHash: `${nodeHash}-objective-${index}`, progress: 0, percent: 0, complete: false }))
      }))
    });
    rank.completed = 0;
    rank.total = 8;
    rank.categories = [category("small-a", "Small A", 2), category("large", "Large", 4), category("small-b", "Small B", 2)];
    vi.mocked(api).mockResolvedValue(response);
    renderPage();

    const left = await screen.findByTestId("category-column-active-0");
    const right = screen.getByTestId("category-column-active-1");
    expect(left.textContent).toContain("Small A");
    expect(left.textContent).toContain("Small B");
    expect(left.textContent).not.toContain("Large");
    expect(right.textContent).toContain("Large");
  });
});

function renderPage() {
  return render(<MemoryRouter initialEntries={["/journey/guardian-rank"]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><GuardianRankPage /></QueryClientProvider></MemoryRouter>);
}

function envelope() {
  const data: GuardianRankData = {
    currentRank: 6,
    renewedRank: 6,
    highestAchievedRank: 8,
    lifetimeHighestRank: 8,
    maximumRank: 9,
    suggestedRank: 6,
    ranks: [
      { rankHash: "6", rankNumber: 6, name: "Veteran", description: "Current rank", icon: "/six.png", foregroundImage: "", overlayImage: "", state: "current", completed: 1, total: 1, categories: [{ nodeHash: "cat6", name: "Power", description: "", icon: "", seasonal: false, completed: 1, total: 1, quests: [{ recordHash: "record6", name: "Ascension", description: "Reach the target.", icon: "", state: "completed", trackedInDestiny: false, objectives: [{ objectiveHash: "objective6", name: "Reach Power", progress: 1, completionValue: 1, percent: 100, complete: true, progressAvailable: true }] }] }] },
      { rankHash: "7", rankNumber: 7, name: "Elite", description: "Next rank", icon: "/seven.png", foregroundImage: "", overlayImage: "", state: "next", completed: 0, total: 1, categories: [{ nodeHash: "cat7", name: "Journey", description: "", icon: "", seasonal: false, completed: 0, total: 1, quests: [{ recordHash: "record7", name: "Service", description: "Complete activities.", icon: "", state: "in-progress", trackedInDestiny: false, objectives: [{ objectiveHash: "objective7", name: "Activities", progress: 4, completionValue: 10, percent: 40, complete: false, progressAvailable: true }] }] }] },
      { rankHash: "8", rankNumber: 8, name: "Justiciar", description: "Highest rank", icon: "/eight.png", foregroundImage: "", overlayImage: "", state: "future", completed: 0, total: 0, categories: [] }
    ],
    sources: { ranks: "DestinyProfileComponent and DestinyGuardianRankDefinition", objectives: "DestinyPresentationNodeDefinition, DestinyRecordDefinition, and profile records (component 900)" }
  };
  return { data, freshness: { state: "fresh" as const, observedAt: "2026-07-21T12:00:00Z" }, warnings: [], requestId: "rank-test" };
}
