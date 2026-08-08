// @vitest-environment jsdom
import type { WeaponItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentItemRow, observedLootWithin, recentLoot } from "./RecentLoot";

const weapon = { instanceId: "1", itemHash: "2", name: "Recent Rifle", icon: "", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 500, location: "vault", equipped: false, locked: false, masterworked: false, crafted: false, enhanced: false, perkColumns: [], originTraits: [], rollDataState: "unavailable", reviewState: "incomplete-data", reviewReasons: [], duplicateCount: 1, wishlisted: false, firstSeenAt: "2026-08-06T12:00:00Z", isNew: true } as WeaponItem;

describe("RecentItemRow", () => {
  afterEach(cleanup);
  it("orders new loot and applies a tag shortcut only to the active item", () => {
    const onTag = vi.fn();
    render(<RecentItemRow title="Recently acquired" items={recentLoot([], [weapon])} onTag={onTag} />);
    const card = screen.getByText("Recent Rifle").closest("article")!;
    fireEvent.mouseEnter(card);
    fireEvent.keyDown(window, { key: "2", shiftKey: true });
    expect(onTag).toHaveBeenCalledWith(expect.objectContaining({ instanceId: "1" }), "keep");
  });

  it("keeps the detail tooltip open when the inspection tile receives focus and a click", () => {
    render(<RecentItemRow title="Recently acquired" items={recentLoot([], [weapon])} onTag={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect Recent Rifle" }));
    expect(screen.getByRole("tooltip").textContent).toContain("Recent Rifle");
  });

  it("keeps reviewed items in rolling history and excludes older observations", () => {
    const now = Date.parse("2026-08-06T12:00:00Z");
    const reviewed = { ...weapon, isNew: false, tag: "keep" as const };
    const old = { ...weapon, instanceId: "old", firstSeenAt: "2026-07-20T12:00:00Z" };

    expect(observedLootWithin([], [reviewed, old], 7, "all", now).map((item) => item.instanceId)).toEqual(["1"]);
  });
});
