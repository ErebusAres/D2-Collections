// @vitest-environment jsdom
import type { ArmorItem, GearData, WeaponItem } from "@guardian-nexus/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VaultWorkspace } from "./VaultWorkspace";

const armor = (instanceId: string, name: string, health: number, rarity = "Legendary", location: ArmorItem["location"] = "vault"): ArmorItem => ({
  instanceId, itemHash: instanceId, name, icon: "", className: "Hunter", slot: "Helmet", rarity, power: 500, location, equipped: false, locked: false, masterworked: false, gearTier: 5,
  setBonuses: [], perks: [], baseStats: { health, melee: 10, grenade: 10, super: 10, class: 10, weapons: 10 }, currentStats: { health, melee: 10, grenade: 10, super: 10, class: 10, weapons: 10 }, adjustments: [],
  baseTotal: health + 50, currentTotal: health + 50, grade: { letter: "B", score: 80 }, firstSeenAt: "2026-08-06T12:00:00Z", isNew: false
});

const weapon = (instanceId: string, name: string, slot: WeaponItem["slot"], location: WeaponItem["location"] = "vault"): WeaponItem => ({
  instanceId, itemHash: instanceId, name, icon: "", itemType: "Auto Rifle", slot, damageType: "Arc", rarity: "Legendary", power: 500, location, equipped: false, locked: false, masterworked: false, crafted: false, enhanced: false,
  perkColumns: [{ socketIndex: 0, active: { hash: "perk", name: "Voltshot", description: "" }, options: [{ hash: "perk", name: "Voltshot", description: "" }] }], originTraits: [], rollDataState: "complete", reviewState: "unique", reviewReasons: ["Only copy"], duplicateCount: 1, wishlisted: false,
  firstSeenAt: "2026-08-05T12:00:00Z", isNew: false
});

const data: GearData = {
  gearSchemaVersion: 2, manifestVersion: "test", selectedCharacterId: "character", selectedClass: "Hunter",
  items: [armor("armor-health", "Health Helmet", 6), armor("armor-zero", "Zero Helmet", 0, "Exotic"), armor("armor-inventory", "Inventory Helmet", 12, "Legendary", "inventory")],
  weapons: [weapon("weapon-energy", "Vault Rifle", "Energy"), weapon("weapon-inventory", "Inventory Rifle", "Kinetic", "inventory")], statIcons: {},
  totals: { armor: 3, weapons: 2, vault: 2, equipped: 0, locked: 0, grouped: 0, newItems: 0 }
};

function renderVault(onAction = vi.fn()) {
  render(<VaultWorkspace data={data} selectedCharacterId="character" onTag={vi.fn()} onAction={onAction} busy={false} />);
  return onAction;
}

describe("VaultWorkspace", () => {
  afterEach(cleanup);

  it("shows only physical Vault items and filters weapon slots and rarity", () => {
    renderVault();
    expect(screen.getByText("Health Helmet")).toBeTruthy();
    expect(screen.getByText("Zero Helmet")).toBeTruthy();
    expect(screen.getByText("Vault Rifle")).toBeTruthy();
    expect(screen.queryByText("Inventory Helmet")).toBeNull();
    expect(screen.queryByText("Inventory Rifle")).toBeNull();

    fireEvent.change(screen.getByLabelText("Vault equipment slot"), { target: { value: "weapon:Energy" } });
    expect(screen.getByText("Vault Rifle")).toBeTruthy();
    expect(screen.queryByText("Health Helmet")).toBeNull();

    fireEvent.change(screen.getByLabelText("Vault equipment slot"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Vault rarity"), { target: { value: "exotic" } });
    expect(screen.getByText("Zero Helmet")).toBeTruthy();
    expect(screen.queryByText("Vault Rifle")).toBeNull();
  });

  it("uses base-stat ranges for armor cleanup and excludes weapons while a stat filter is active", () => {
    renderVault();
    fireEvent.change(screen.getByLabelText("Minimum Health"), { target: { value: "1" } });
    expect(screen.getByText("Health Helmet")).toBeTruthy();
    expect(screen.queryByText("Zero Helmet")).toBeNull();
    expect(screen.queryByText("Vault Rifle")).toBeNull();

    fireEvent.change(screen.getByLabelText("Minimum Health"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Maximum Health"), { target: { value: "0" } });
    expect(screen.getByText("Zero Helmet")).toBeTruthy();
    expect(screen.queryByText("Health Helmet")).toBeNull();
  });

  it("offers supported Vault actions but does not claim it can dismantle", () => {
    const onAction = renderVault();
    fireEvent.click(screen.getByRole("button", { name: "Pull Vault Rifle to selected Guardian" }));
    expect(onAction).toHaveBeenCalledWith({ action: "transfer", itemInstanceId: "weapon-energy", target: "character", targetCharacterId: "character" });
    expect(screen.getByText("Dismantling is not available to third-party Destiny apps")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /dismantle|delete/i })).toBeNull();
  });
});
