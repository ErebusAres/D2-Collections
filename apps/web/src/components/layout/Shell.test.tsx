// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../services/api/client";
import { Shell } from "./Shell";

vi.mock("../../context/GuardianContext", () => ({
  useGuardian: () => ({
    session: {
      authenticated: true,
      guardian: {
        membershipId: "preview",
        membershipType: 3,
        displayName: "FearsRedemption",
        bungieName: "FearsRedemption#9656",
        selectedCharacterId: "hunter",
        characters: [{ characterId: "hunter", className: "Hunter", raceName: "Human", emblemPath: "/emblem.svg", emblemBackgroundPath: "/banner.svg", power: 409, dateLastPlayed: "2026-07-16T00:00:00Z", minutesPlayedThisSession: 1 }],
        stats: { power: 409, guardianRank: 5, crucibleRank: { kind: "crucible", progressionHash: "10", name: "Crucible Rank", description: "", icon: "", rankName: "Brave II", level: 7, stepIndex: 1, currentProgress: 4_250, progressToNextLevel: 250, nextLevelAt: 500, percent: 50, resets: 2 }, rewardsPassRank: 33, rewardsPassProgress: { state: "available", source: "bungie-profile-character-progressions", progressToNextLevel: 2_750, nextLevelAt: 100_000 }, mailboxCount: 4 },
        isInGame: false
      },
      roles: { dev: false, matrixWriter: false, buildEditor: false }
    },
    loading: false,
    signIn: vi.fn(),
    selectedCharacterId: "hunter",
    autoRefresh: false
  })
}));

vi.mock("../../services/api/client", () => {
  const connectionSnapshot = { queued: 0, retrying: false };
  return {
    api: vi.fn().mockResolvedValue({ data: { rewards: [] }, freshness: { state: "fresh", observedAt: "2026-07-16T00:00:00Z" }, warnings: [], requestId: "test" }),
    getConnectionSnapshot: () => connectionSnapshot,
    subscribeConnection: () => () => undefined
  };
});

vi.mock("../reward-codes/RewardCodeMarquee", () => ({ RewardCodeMarquee: () => null }));
vi.mock("../../modules/reward-codes/rewardCodes", () => ({ activeRewardCodes: () => [{ code: "NEW-CODE" }] }));
vi.mock("../../modules/reward-codes/rewardCodeStatus", () => ({ useRewardCodeStatus: () => ({ hidden: new Set(["NEW-CODE"]) }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Shell guardian identity", () => {
  it("keeps the square emblem and adds the selected character's matching wide banner", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Routes><Route element={<Shell />}><Route index element={<div>Page</div>} /></Route></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(container.querySelector('img[src="/emblem.svg"]')).toBeTruthy();
    expect(screen.getByTestId("guardian-banner")).toBeTruthy();
    expect(container.querySelector("[style]")?.getAttribute("style")).toContain("--guardian-banner: url(/banner.svg)");
    expect(screen.getByLabelText("Reward Codes: 0 · Open").getAttribute("href")).toBe("/codes");
    expect(screen.getByLabelText("Crucible Rank: 7 · Brave II · Open").getAttribute("href")).toBe("/pvp");
    expect(screen.getByLabelText("Light Level: 409 · Open").getAttribute("href")).toBe("/power");
    expect(screen.getByLabelText("Guardian Rank: 5 · Open").getAttribute("href")).toBe("/guardian-rank");
    const statLabels = [...screen.getByLabelText("Guardian stats").children].map((entry) => entry.getAttribute("aria-label"));
    expect(statLabels.slice(1, 4)).toEqual(["Guardian Rank: 5 · Open", "Crucible Rank: 7 · Brave II · Open", "Rewards Pass: 33 · Open"]);
    expect(screen.getByText("2,750 / 100,000 XP (2%)")).toBeTruthy();
    expect(screen.queryByText(/Open pass/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open options" }));
    const feedback = screen.getByRole("link", { name: /Feedback & bug reports/i });
    expect(feedback.getAttribute("href")).toBe("https://github.com/ErebusAres/D2-Collections/issues");
    expect(feedback.getAttribute("target")).toBe("_blank");
    expect(feedback.getAttribute("rel")).toBe("noreferrer");
  });

  it("uses the live rewards rank when the session snapshot is stale", async () => {
    vi.mocked(api).mockResolvedValueOnce({
      data: {
        rank: 101,
        progress: {
          state: "available",
          source: "bungie-profile-character-progressions",
          progressionMode: "bright-engram",
          progressToNextLevel: 439_174,
          nextLevelAt: 500_000,
          segmentsPerRank: 5
        },
        rewards: []
      },
      freshness: { state: "fresh", observedAt: "2026-07-20T00:00:00Z" },
      warnings: [],
      requestId: "rank-test"
    });

    renderShell(<div>Page</div>);

    expect(await screen.findByLabelText("Rewards Pass: 101 · Open")).toBeTruthy();
    expect(screen.getByTitle(/4\/5 pips beyond rank 101/)).toBeTruthy();
    expect(screen.getByText("439,174 / 500,000 XP (87%)")).toBeTruthy();
  });

  it("focuses the page search for Ctrl+F and reveals a scroll-to-top control on long pages", async () => {
    Object.defineProperty(window, "scrollY", { configurable: true, value: 900 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2400 });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderShell(<input type="search" placeholder="Search this page" defaultValue="existing" />);

    const search = screen.getByPlaceholderText<HTMLInputElement>("Search this page");
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    expect(document.activeElement).toBe(search);
    expect(search.selectionStart).toBe(0);
    expect(search.selectionEnd).toBe("existing".length);

    fireEvent.scroll(window);
    const button = await screen.findByRole("button", { name: "Scroll to top" });
    fireEvent.click(button);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});

function renderShell(page: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Routes><Route element={<Shell />}><Route index element={page} /></Route></Routes></MemoryRouter></QueryClientProvider>);
}
