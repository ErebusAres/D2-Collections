// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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
        stats: { power: 409, guardianRank: 5, rewardsPassRank: 33, rewardsPassProgress: { state: "available", source: "bungie-profile-character-progressions", progressToNextLevel: 2_750, nextLevelAt: 100_000 }, mailboxCount: 4 },
        isInGame: false
      },
      roles: { dev: false, matrixWriter: false }
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
  });
});
