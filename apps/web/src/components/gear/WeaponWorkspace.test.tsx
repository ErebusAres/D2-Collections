// @vitest-environment jsdom
import type { GearData, WeaponItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeaponWorkspace } from "./WeaponWorkspace";

const weapon = (instanceId: string, perk: string): WeaponItem => ({
  instanceId, itemHash: "10", name: "Test Rifle", icon: "/rifle.png", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 500,
  location: "vault", equipped: false, locked: false, masterworked: false, gearTier: 4, crafted: false, enhanced: false,
  perkColumns: [
    { socketIndex: 2, ratingColumn: 2, active: { hash: "Perpetual Motion", name: "Perpetual Motion", description: "Builds stability while moving." }, options: [
      { hash: "Perpetual Motion", name: "Perpetual Motion", description: "Builds stability while moving." },
      { hash: "Keep Away", name: "Keep Away", description: "Improves performance at range." }
    ] },
    { socketIndex: 3, ratingColumn: 3, active: { hash: perk, name: perk, description: "" }, options: [
      { hash: "Incandescent", name: "Incandescent", description: "Spreads scorch." },
      { hash: "Target Lock", name: "Target Lock", description: "Builds damage on one target." },
      { hash: "Backup Plan", name: "Backup Plan", description: "Readies faster after swapping." }
    ] }
  ],
  originTraits: [], rollDataState: "complete", reviewState: "duplicate-review", reviewReasons: ["Compare physical copies."], duplicateCount: 2, wishlisted: false,
  firstSeenAt: "2026-08-01T00:00:00Z", isNew: false
});

const data: GearData = {
  gearSchemaVersion: 2, manifestVersion: "test", selectedCharacterId: "character", selectedClass: "Warlock", items: [],
  weapons: [weapon("1", "Incandescent"), weapon("2", "Target Lock")], statIcons: {},
  totals: { armor: 0, weapons: 2, vault: 0, equipped: 0, locked: 0, grouped: 0, newItems: 0 }
};

describe("WeaponWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 4, reviewedAt: "2026-08-10", source: { name: "DIM" }, method: { columnWeights: [1, 1, 1, 1] },
      coverage: { manifestWeapons: 1, reviewedWeapons: 1, supportedTypes: 1, reviewedTypes: 1 }, types: {},
      items: { "10": { itemType: "Auto Rifle", pve: { recommendations: 3, columns: [[], [], ["Perpetual Motion", "Keep Away"], ["Incandescent", "Target Lock"]], traitPairs: ["Perpetual Motion,Incandescent", "Perpetual Motion,Target Lock", "Keep Away,Target Lock"] }, pvp: { recommendations: 0, columns: [[], [], [], []], traitPairs: [] } } }
    }) }));
  });
  afterEach(cleanup);

  it("shows physical rolls and opens a perk-column duplicate comparison", () => {
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={vi.fn()} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    expect(screen.getAllByText("Test Rifle")).toHaveLength(2);
    expect(screen.getAllByText("Incandescent").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Weapon tier 4")).toHaveLength(2);
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

  it("shows the shared sourced rating on every weapon card", async () => {
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={vi.fn()} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    await waitFor(() => expect(screen.getAllByText("Roll 100%")).toHaveLength(2));
    expect(screen.getAllByText(/Excellent · exact weapon · high confidence/)).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("shows and rates every selectable trait while leaving non-recommended options visible", async () => {
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={vi.fn()} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    await waitFor(() => expect(screen.getAllByLabelText("DIM recommends Target Lock for PvE")).toHaveLength(2));
    expect(screen.getAllByText("Keep Away")).toHaveLength(2);
    expect(screen.getAllByText("Backup Plan")).toHaveLength(2);
    expect(screen.getAllByText("PvE × · PvP —")).toHaveLength(2);
  });
});
