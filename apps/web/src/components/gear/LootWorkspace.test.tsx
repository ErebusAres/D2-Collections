// @vitest-environment jsdom
import type { RecentItemEvent, RecentItemTimelineData } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LootWorkspace } from "./LootWorkspace";

const weaponGear: any = { kind: "weapon", instanceId: "weapon-0", itemHash: "100", name: "Newest Rifle", icon: "", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 500, location: "vault", equipped: false, locked: false, masterworked: false, gearTier: 4, crafted: false, enhanced: false, perkColumns: [], originTraits: [], rollDataState: "unavailable", reviewState: "incomplete-data", reviewReasons: [], duplicateCount: 1, wishlisted: false, firstSeenAt: "2026-08-08T12:00:00Z", isNew: true };
const armorGear: any = { kind: "armor", instanceId: "armor-0", itemHash: "200", name: "New Helm", icon: "", slot: "Helmet", rarity: "Legendary", power: 500, location: "vault", equipped: false, locked: false, masterworked: false, className: "Warlock", baseStats: {}, currentStats: {}, adjustments: [], baseTotal: 60, currentTotal: 60, grade: { letter: "B" }, gearTier: 3, archetype: undefined, setBonuses: [], firstSeenAt: "2026-08-08T11:00:00Z", isNew: true };

function event(id: string, kind: RecentItemEvent["kind"], name: string, observedAt: string, gear?: any): RecentItemEvent {
  return { id, kind, sourceKey: id, name, icon: "", quantity: 1, observedAt, lastObservedAt: observedAt, gear };
}

describe("LootWorkspace", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("separates weapons, armor, and miscellaneous loot into newest-to-oldest rows", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const timeline: RecentItemTimelineData = {
      timelineSchemaVersion: 1,
      retentionDays: 30,
      firstObservationEstablished: true,
      observedAt: "2026-08-08T12:00:00Z",
      events: [
        event("weapon-old", "weapon-found", "Older Rifle", "2026-08-08T10:00:00Z", { ...weaponGear, instanceId: "weapon-old", name: "Older Rifle" }),
        event("core", "inventory-gained", "Enhancement Core", "2026-08-08T11:30:00Z"),
        event("armor", "armor-found", "New Helm", "2026-08-08T11:00:00Z", armorGear),
        event("weapon-new", "weapon-found", "Newest Rifle", "2026-08-08T12:00:00Z", weaponGear),
        event("engram", "exotic-engram-found", "Exotic Engram", "2026-08-08T09:00:00Z"),
        event("catalyst", "catalyst-found", "Sunshot Catalyst", "2026-08-08T08:00:00Z")
      ]
    };
    render(<MemoryRouter><LootWorkspace timeline={timeline} onTag={vi.fn()} busy={false} /></MemoryRouter>);

    const weaponRow = screen.getByText("Recent Weapons").closest("section")!;
    const armorRow = screen.getByText("Recent Armor").closest("section")!;
    const lootRow = screen.getByText("Recent Loot").closest("section")!;
    expect(within(weaponRow).getAllByRole("button", { name: /Inspect/ }).map((button) => button.getAttribute("aria-label"))).toEqual(["Inspect Newest Rifle", "Inspect Older Rifle"]);
    expect(within(weaponRow).getAllByLabelText("Weapon tier 4")).toHaveLength(2);
    expect(within(armorRow).getByRole("button", { name: "Inspect New Helm" })).toBeTruthy();
    expect(within(armorRow).getByLabelText("Armor tier 3")).toBeTruthy();
    expect(within(lootRow).getAllByRole("button", { name: /Inspect/ }).map((button) => button.getAttribute("aria-label"))).toEqual(["Inspect Enhancement Core", "Inspect Exotic Engram", "Inspect Sunshot Catalyst"]);
    expect(within(lootRow).queryByRole("button", { name: /Rifle|Helm/ })).toBeNull();
    expect(within(lootRow).queryByLabelText(/tier/i)).toBeNull();
  });

  it("pages a full weapon row instead of capping its history", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const events = Array.from({ length: 13 }, (_, index) => event(`weapon-${index}`, "weapon-found", `Rifle ${index}`, `2026-08-08T${String(23 - index).padStart(2, "0")}:00:00Z`, { ...weaponGear, instanceId: `weapon-${index}`, name: `Rifle ${index}` }));
    const timeline: RecentItemTimelineData = { timelineSchemaVersion: 1, retentionDays: 30, firstObservationEstablished: true, observedAt: "2026-08-08T23:00:00Z", events };
    render(<MemoryRouter><LootWorkspace timeline={timeline} onTag={vi.fn()} busy={false} /></MemoryRouter>);

    const weaponRow = screen.getByText("Recent Weapons").closest("section")!;
    expect(within(weaponRow).getAllByRole("button", { name: /Inspect Rifle/ })).toHaveLength(12);
    expect(within(weaponRow).getByText("1 / 2")).toBeTruthy();
    fireEvent.click(within(weaponRow).getByRole("button", { name: "Next Recent Weapons page" }));
    expect(within(weaponRow).getByRole("button", { name: "Inspect Rifle 12" })).toBeTruthy();
    expect(within(weaponRow).getByText("2 / 2")).toBeTruthy();
  });

  it("passes the P shortcut from a selected gear item to the page transfer action", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const onPull = vi.fn();
    const timeline: RecentItemTimelineData = { timelineSchemaVersion: 1, retentionDays: 30, firstObservationEstablished: true, observedAt: "2026-08-08T12:00:00Z", events: [event("weapon-new", "weapon-found", "Newest Rifle", "2026-08-08T12:00:00Z", weaponGear)] };
    render(<MemoryRouter><LootWorkspace timeline={timeline} onTag={vi.fn()} onPull={onPull} busy={false} /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Inspect Newest Rifle" }));
    fireEvent.keyDown(window, { key: "p" });
    expect(onPull).toHaveBeenCalledWith(expect.objectContaining({ instanceId: "weapon-0" }));
  });
});
