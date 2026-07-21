// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RewardCodeMarquee } from "./RewardCodeMarquee";

vi.mock("../../context/GuardianContext", () => ({ useGuardian: () => ({ session: { authenticated: false }, autoRefresh: false }) }));
vi.mock("../../modules/reward-codes/rewardCodeStatus", () => ({ useRewardCodeStatus: () => ({ hidden: new Set<string>() }) }));
vi.mock("../../modules/reward-codes/rewardCodes", () => ({
  activeRewardCodes: () => Array.from({ length: 12 }, (_, index) => ({ code: `CODE-${index}`, reward: `Reward ${index}`, kind: "Emblem" }))
}));

afterEach(cleanup);

describe("RewardCodeMarquee", () => {
  it("shows a small preview instead of duplicating the entire reward catalog", () => {
    const { container } = render(<MemoryRouter><RewardCodeMarquee /></MemoryRouter>);
    expect(screen.getByLabelText("12 active reward codes not already owned or marked used. Open the full code catalog.")).toBeTruthy();
    expect(container.querySelectorAll("b")).toHaveLength(3);
    expect(screen.getByText("+9 more")).toBeTruthy();
  });
});
