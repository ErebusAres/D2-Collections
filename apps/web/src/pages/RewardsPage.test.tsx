// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RewardLevelColumn } from "./RewardsPage";

describe("RewardLevelColumn", () => {
  it("marks the current rank rather than the next obtainable rank", () => {
    const current = render(<RewardLevelColumn entry={{ level: 33, rewards: [] }} currentRank={33} />);
    expect(current.container.querySelector("article")?.getAttribute("aria-current")).toBe("step");
    current.unmount();

    const next = render(<RewardLevelColumn entry={{ level: 34, rewards: [] }} currentRank={33} />);
    expect(next.container.querySelector("article")?.hasAttribute("aria-current")).toBe(false);
  });
});
