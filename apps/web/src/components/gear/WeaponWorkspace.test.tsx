// @vitest-environment jsdom
import type { GearData, WeaponItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeaponWorkspace } from "./WeaponWorkspace";

const weapon = (instanceId: string, perk: string): WeaponItem => ({
  instanceId, itemHash: "10", name: "Test Rifle", icon: "/rifle.png", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 500,
  location: "vault", equipped: false, locked: false, masterworked: false, crafted: false, enhanced: false,
  perkColumns: [{ socketIndex: 0, active: { hash: perk, name: perk, description: "" }, options: [{ hash: perk, name: perk, description: "" }] }],
  originTraits: [], rollDataState: "complete", reviewState: "duplicate-review", reviewReasons: ["Compare physical copies."], duplicateCount: 2, wishlisted: false,
  firstSeenAt: "2026-08-01T00:00:00Z", isNew: false
});

const data: GearData = {
  gearSchemaVersion: 2, manifestVersion: "test", selectedCharacterId: "character", selectedClass: "Warlock", items: [],
  weapons: [weapon("1", "Incandescent"), weapon("2", "Target Lock")], statIcons: {},
  totals: { armor: 0, weapons: 2, vault: 0, equipped: 0, locked: 0, grouped: 0, newItems: 0 }
};

describe("WeaponWorkspace", () => {
  afterEach(cleanup);

  it("shows physical rolls and opens a perk-column duplicate comparison", () => {
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={vi.fn()} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    expect(screen.getAllByText("Test Rifle")).toHaveLength(2);
    expect(screen.getByText("Incandescent")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Compare 2" })[0]!);
    expect(screen.getByText("Weapon roll comparison")).toBeTruthy();
    expect(screen.getAllByText("Target Lock").length).toBeGreaterThan(0);
  });

  it("persists a weapon-name wishlist without exposing inventory publicly", () => {
    const setPreference = vi.fn();
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={setPreference} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    fireEvent.click(screen.getAllByTitle("Add weapon to wishlist")[0]!);
    expect(setPreference).toHaveBeenCalledWith("weapons.wishlist", JSON.stringify(["10"]));
  });
});
