// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LootTierBadge, lootTier } from "./LootTierBadge";

afterEach(cleanup);

describe("LootTierBadge", () => {
  it("maps every Destiny manifest tier and supported display-name alias", () => {
    expect(["Exotic", "Superior", "Legendary", "Rare", "Common", "Basic", "Uncommon", "Currency", "Unknown", undefined].map(lootTier))
      .toEqual([6, 5, 5, 4, 3, 2, 2, 1, 0, 0]);
  });

  it("keeps the numeric tier accessible when overlaid on an item icon", () => {
    render(<LootTierBadge rarity="Superior" variant="overlay" />);
    const badge = screen.getByLabelText("Tier 5 Superior");
    expect(badge.textContent).toBe("5");
    expect(badge.getAttribute("data-tier")).toBe("5");
    expect(badge.getAttribute("title")).toBe("Tier 5 · Superior");
  });
});
