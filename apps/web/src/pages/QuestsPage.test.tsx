// @vitest-environment jsdom

import type { QuestProgress } from "@guardian-nexus/contracts";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { QuestInspectPanel } from "./QuestsPage";

const quest: QuestProgress = {
  instanceId: "quest-instance",
  itemHash: "100",
  name: "A Bray-style Quest",
  description: "Complete every listed objective.",
  flavorText: "A line from the Destiny manifest.",
  itemType: "Quest Step",
  rarity: "Exotic",
  icon: "https://www.bungie.net/quest.png",
  currentStep: "Finish the work.",
  characterId: "c1",
  inGameTracked: true,
  sitePinned: false,
  isExoticUnlock: true,
  rewards: [
    { itemHash: "501", name: "Reward Weapon", description: "First reward", icon: "https://www.bungie.net/reward.png", quantity: 1, definitionAvailable: true },
    { itemHash: "502", name: "Reward Currency", description: "Second reward", icon: "https://www.bungie.net/currency.png", quantity: 5, definitionAvailable: true }
  ],
  objectives: [
    { objectiveHash: "1", name: "Completed objective", progress: 1, completionValue: 1, complete: true, percent: 100 },
    { objectiveHash: "2", name: "Active objective", progress: 4, completionValue: 10, complete: false, percent: 40 }
  ],
  percent: 70,
  updatedAt: "2026-07-15T00:00:00Z",
  category: "quest"
};

describe("QuestInspectPanel", () => {
  it("shows every live objective, flavor text, and each manifest-resolved reward image", () => {
    const { container } = render(<MemoryRouter><QuestInspectPanel quest={quest} onClose={vi.fn()} /></MemoryRouter>);

    expect(screen.getByText("A Bray-style Quest")).toBeTruthy();
    expect(screen.getByText("Quest Step · Exotic")).toBeTruthy();
    expect(screen.getByText("A line from the Destiny manifest.")).toBeTruthy();
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(screen.getByText("4 / 10")).toBeTruthy();
    expect(screen.getByText("Reward Weapon")).toBeTruthy();
    expect(screen.getByText("Reward Currency")).toBeTruthy();
    expect(screen.getByText("×5")).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(3);
    expect([...container.querySelectorAll("img")].map((image) => image.src)).toEqual([
      "https://www.bungie.net/quest.png",
      "https://www.bungie.net/reward.png",
      "https://www.bungie.net/currency.png"
    ]);
    expect(screen.getByText("Active objective").closest("article")?.querySelector("i span")?.getAttribute("style")).toContain("40%");
  });
});
