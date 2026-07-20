// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardLevelColumn } from "../components/rewards/RewardLevelColumn";

describe("RewardLevelColumn", () => {
  it("marks the current rank rather than the next obtainable rank", () => {
    const current = render(<RewardLevelColumn entry={{ level: 33, rewards: [] }} currentRank={33} />);
    expect(current.container.querySelector("article")?.getAttribute("aria-current")).toBe("step");
    current.unmount();

    const next = render(<RewardLevelColumn entry={{ level: 34, rewards: [] }} currentRank={33} />);
    expect(next.container.querySelector("article")?.hasAttribute("aria-current")).toBe(false);
  });

  it("renders post-100 rank pips from the current visible rank", () => {
    const current = render(<RewardLevelColumn entry={{ level: 101, rewards: [] }} currentRank={101} currentRankSegments={[100, 100, 100, 100, 0]} />);
    expect(current.getByLabelText("Rank 101 post-100 pips: 4 of 5 filled")).toBeTruthy();
    expect(current.container.textContent).toContain("101");
    current.unmount();

    const next = render(<RewardLevelColumn entry={{ level: 102, rewards: [] }} currentRank={101} currentRankSegments={[100, 100, 100, 100, 0]} />);
    expect(next.getByLabelText("Rank 102 post-100 pips: 0 of 5 filled")).toBeTruthy();
  });
});
