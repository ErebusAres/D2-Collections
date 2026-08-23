// @vitest-environment jsdom
import type { GearData, WeaponItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeaponWorkspace } from "./WeaponWorkspace";
import { useState } from "react";
import { WeaponRatingProvider } from "../../context/WeaponRatingContext";

const weapon = (instanceId: string, perk: string): WeaponItem => ({
  instanceId, itemHash: "10", name: "Test Rifle", icon: "/rifle.png", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 500,
  location: "vault", equipped: false, locked: false, masterworked: false, gearTier: 4, crafted: false, enhanced: false,
  perkColumns: [
    { socketIndex: 0, ratingColumn: 0, active: { hash: "Arrowhead Brake", name: "Arrowhead Brake", description: "Controls recoil." }, options: [] },
    { socketIndex: 1, ratingColumn: 1, active: { hash: "Tactical Mag", name: "Tactical Mag", description: "Improves magazine and stability." }, options: [] },
    { socketIndex: 2, ratingColumn: 2, selectablePlugHashes: ["Perpetual Motion", "Keep Away"], active: { hash: "Perpetual Motion", name: "Perpetual Motion", description: "Builds stability while moving." }, options: [
      { hash: "Perpetual Motion", name: "Perpetual Motion", description: "Builds stability while moving." },
      { hash: "Keep Away", name: "Keep Away", description: "Improves performance at range." }
    ] },
    { socketIndex: 3, ratingColumn: 3, selectablePlugHashes: [perk, "Backup Plan"], active: { hash: perk, name: perk, description: "" }, options: [
      { hash: "Incandescent", name: "Incandescent", description: "Spreads scorch." },
      { hash: "Target Lock", name: "Target Lock", description: "Builds damage on one target." },
      { hash: "Backup Plan", name: "Backup Plan", description: "Readies faster after swapping." },
      { hash: "Potential Only", name: "Potential Only", description: "Definition pool only." }
    ] },
    { socketIndex: 4, kind: "origin", selectablePlugHashes: ["Origin A", "Origin B"], active: { hash: "Origin A", name: "Origin A", description: "Foundry origin." }, options: [{ hash: "Origin A", name: "Origin A", description: "Foundry origin." }, { hash: "Origin B", name: "Origin B", description: "Seasonal origin." }] }
  ],
  originTraits: [], rollDataState: "complete", reviewState: "duplicate-review", reviewReasons: ["Compare physical copies."], duplicateCount: 2, wishlisted: false,
  firstSeenAt: "2026-08-01T00:00:00Z", isNew: false
});

const data: GearData = {
  gearSchemaVersion: 2, manifestVersion: "test", selectedCharacterId: "character", selectedClass: "Warlock", items: [],
  weapons: [weapon("1", "Incandescent"), weapon("2", "Target Lock")], statIcons: {},
  totals: { armor: 0, weapons: 2, vault: 0, equipped: 0, locked: 0, grouped: 0, newItems: 0 }
};

function RatingSourceHarness({ setPreference }: { setPreference: ReturnType<typeof vi.fn> }) {
  const [source, setSource] = useState("voltron");
  return <WeaponRatingProvider value={source} onChange={(next) => { setSource(next); setPreference("weapons.ratingSource.v1", next); }}><WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={setPreference} onTag={vi.fn()} onAction={vi.fn()} busy={false} /></WeaponRatingProvider>;
}

describe("WeaponWorkspace", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 4, reviewedAt: "2026-08-10", source: { name: "DIM" }, method: { columnWeights: [1, 1, 1, 1] },
      coverage: { manifestWeapons: 1, reviewedWeapons: 1, supportedTypes: 1, reviewedTypes: 1 }, types: {},
      items: { "10": { itemType: "Auto Rifle", pve: { recommendations: 3, columns: [["Arrowhead Brake"], ["Tactical Mag"], ["Perpetual Motion", "Keep Away"], ["Incandescent", "Target Lock"]], traitPairs: ["Perpetual Motion,Incandescent", "Perpetual Motion,Target Lock", "Keep Away,Target Lock"] }, pvp: { recommendations: 0, columns: [[], [], [], []], traitPairs: [] } } }
    }) }));
  });
  afterEach(cleanup);

  it("shows physical rolls and opens a perk-column duplicate comparison", () => {
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={vi.fn()} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    expect(screen.getAllByText("Test Rifle")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Incandescent/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Weapon tier 4")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Compare 2" })[0]!);
    expect(screen.getByText("Weapon roll comparison")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Target Lock/ }).length).toBeGreaterThan(0);
  });

  it("persists a weapon-name wishlist without exposing inventory publicly", () => {
    const setPreference = vi.fn();
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={setPreference} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    fireEvent.click(screen.getAllByTitle("Add weapon to wishlist")[0]!);
    expect(setPreference).toHaveBeenCalledWith("weapons.wishlist", JSON.stringify(["10"]));
  });

  it("shows the shared sourced rating on every weapon card", async () => {
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={vi.fn()} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    await waitFor(() => expect(screen.getAllByText("Excellent")).toHaveLength(2));
    expect(screen.getAllByText("PvE").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/high confidence/)).toHaveLength(2);
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("persists one rating source for every weapon surface and labels who uses it", async () => {
    const setPreference = vi.fn();
    render(<RatingSourceHarness setPreference={setPreference} />);
    const selector = screen.getAllByLabelText("Weapon rating source").find((entry) => entry.hasAttribute("title"))!;
    expect(selector.textContent).toContain("Voltron · Used by: DIM (default), Destiny Recipes");
    await waitFor(() => expect((selector as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(selector, { target: { value: "choosy-voltron" } });
    expect(setPreference).toHaveBeenCalledWith("weapons.ratingSource.v1", "choosy-voltron");
  });

  it("shows and rates every selectable trait while leaving non-recommended options visible", async () => {
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={vi.fn()} onTag={vi.fn()} onAction={vi.fn()} busy={false} />);
    await waitFor(() => expect(screen.getAllByLabelText(/Keep Away.*PvE curator recommended/)).toHaveLength(2));
    fireEvent.mouseEnter(screen.getAllByRole("button", { name: /Keep Away/ })[0]!);
    expect(screen.getByRole("tooltip").parentElement).toBe(document.body);
    expect(screen.getAllByLabelText(/Backup Plan/)).toHaveLength(2);
    expect(screen.queryByLabelText(/Potential Only/)).toBeNull();
    expect(screen.getAllByText("Barrel")).toHaveLength(2);
    expect(screen.getAllByText("Magazine")).toHaveLength(2);
    expect(screen.getAllByText("Origin Trait")).toHaveLength(2);
    expect(screen.getAllByLabelText(/PvE not recommended for this weapon/).length).toBeGreaterThan(1);
    const pveMarks = screen.getAllByLabelText(/^PvE:/);
    const pvpMarks = screen.getAllByLabelText(/^PvP:/);
    expect(pveMarks.length).toBeGreaterThan(0);
    expect(pvpMarks.length).toBe(pveMarks.length);
    expect(pveMarks.every((mark) => mark.getAttribute("data-mode") === "pve" && mark.textContent === "")).toBe(true);
    expect(pvpMarks.every((mark) => mark.getAttribute("data-mode") === "pvp" && mark.textContent === "")).toBe(true);
    expect(pveMarks.some((mark) => mark.querySelector('[data-thumb="up"]'))).toBe(true);
    expect(pveMarks.some((mark) => mark.querySelector('[data-thumb="down"]'))).toBe(true);
  });

  it("selects only plugs available on the owned roll across traits and origin traits", () => {
    const onAction = vi.fn();
    render(<WeaponWorkspace data={data} selectedCharacterId="character" preferences={{}} setPreference={vi.fn()} onTag={vi.fn()} onAction={onAction} busy={false} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Keep Away.*Select this option/ })[0]!);
    expect(onAction).toHaveBeenCalledWith({ action: "setWeaponSocket", itemInstanceId: "1", characterId: "character", socketIndex: 2, plugItemHash: "Keep Away" });
    fireEvent.click(screen.getAllByRole("button", { name: /Origin B.*Select this option/ })[0]!);
    expect(onAction).toHaveBeenCalledWith({ action: "setWeaponSocket", itemInstanceId: "1", characterId: "character", socketIndex: 4, plugItemHash: "Origin B" });
    expect(screen.getAllByRole("button", { name: /Target Lock/ })).toHaveLength(1);
  });
});
