// @vitest-environment jsdom
import type { WeaponItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentItemRow, observedLootWithin, recentLoot } from "./RecentLoot";

const weapon = { instanceId: "1", itemHash: "2", name: "Recent Rifle", icon: "", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 500, location: "vault", equipped: false, locked: false, masterworked: false, crafted: false, enhanced: false, perkColumns: [], originTraits: [], rollDataState: "unavailable", reviewState: "incomplete-data", reviewReasons: [], duplicateCount: 1, wishlisted: false, firstSeenAt: "2026-08-06T12:00:00Z", isNew: true } as WeaponItem;

describe("RecentItemRow", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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

  it("shows a sourced quality tier, mode scores, confidence, and rating basis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 3, reviewedAt: "2026-08-08", source: { name: "DIM Voltron" }, method: { columnWeights: [.25, .25, 1, 1] },
      coverage: { manifestWeapons: 1, reviewedWeapons: 1, supportedTypes: 1, reviewedTypes: 1 }, types: {},
      items: { "2": {
        itemType: "Auto Rifle",
        pve: { recommendations: 1, columns: [["10"], ["11"], ["12"], ["13"]] },
        pvp: { recommendations: 1, columns: [["20"], ["11"], ["22"], ["13"]] }
      } }
    }) }));
    const rated = { ...weapon, rollDataState: "complete" as const, perkColumns: ["10", "11", "12", "13"].map((hash, socketIndex) => ({ socketIndex, ratingColumn: socketIndex as 0 | 1 | 2 | 3, active: { hash, name: `Perk ${hash}`, description: "" }, options: [] })) };
    render(<RecentItemRow title="Recently acquired" items={recentLoot([], [rated])} onTag={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("75%")).toBeTruthy());
    expect(screen.getByText("Strong")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inspect Recent Rifle" }));
    expect(screen.getByRole("tooltip").textContent).toContain("Exact weapon evidence");
    expect(screen.getByRole("tooltip").textContent).toContain("Confidencehigh");
    expect(screen.getByRole("tooltip").textContent).toContain("PvE100%");
    expect(screen.getByRole("tooltip").textContent).toContain("PvP50%");
  });
});
