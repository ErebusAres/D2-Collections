// @vitest-environment jsdom
import type { WeaponItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentItemRow, recentLoot } from "./RecentLoot";

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
});
