import type { ArmorItem, GearData, LootWatcherConfig, WeaponItem } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { planLootWatchers } from "./lootWatchers";

const off: LootWatcherConfig = { farmingMode: false, highestPowerLock: false, tier5FitLock: false, duplicateFitJunk: false };
const armor = (instanceId: string, values: Partial<ArmorItem> = {}): ArmorItem => ({
  instanceId, itemHash: instanceId, name: "Aion Adapter", icon: "", className: "Warlock", slot: "Helmet", rarity: "Legendary", power: 500,
  ownerCharacterId: "c1", location: "vault", equipped: false, locked: false, masterworked: false, gearTier: 4,
  archetype: { hash: "paragon", name: "Paragon", description: "" }, tunedStat: "grenade", setBonuses: [], perks: [],
  baseStats: { health: 10, melee: 10, grenade: 20, super: 10, class: 10, weapons: 10 }, currentStats: { health: 10, melee: 10, grenade: 20, super: 10, class: 10, weapons: 10 },
  adjustments: [], baseTotal: 70, currentTotal: 70, grade: { letter: "A" }, firstSeenAt: "2026-08-20T00:00:00Z", isNew: false, ...values
});
const weapon = (instanceId: string, values: Partial<WeaponItem> = {}): WeaponItem => ({
  instanceId, itemHash: instanceId, name: "Test Rifle", icon: "", itemType: "Auto Rifle", slot: "Energy", damageType: "Arc", rarity: "Legendary", power: 500,
  ownerCharacterId: "c1", location: "inventory", equipped: false, locked: false, masterworked: false, gearTier: 3, crafted: false, enhanced: false,
  perkColumns: [], originTraits: [], rollDataState: "complete", reviewState: "unique", reviewReasons: [], duplicateCount: 1, wishlisted: false,
  firstSeenAt: "2026-08-20T00:00:00Z", isNew: false, ...values
});
const gear = (items: ArmorItem[] = [], weapons: WeaponItem[] = []): GearData => ({ gearSchemaVersion: 2, manifestVersion: "test", selectedCharacterId: "c1", selectedClass: "Warlock", items, weapons, statIcons: {}, totals: { armor: items.length, weapons: weapons.length, vault: 0, equipped: 0, locked: 0, grouped: 0, newItems: 0 } });

describe("planLootWatchers", () => {
  it("does nothing when every watcher is off", () => expect(planLootWatchers(gear([armor("a")], [weapon("w")]), off, new Set())).toEqual({ moveToVault: [], lock: [], tagJunk: [], skipped: [] }));

  it("locks the highest Power item in each weapon and armor slot", () => {
    const plan = planLootWatchers(gear([armor("a", { power: 500 }), armor("b", { power: 510 })], [weapon("w1", { power: 505 }), weapon("w2", { power: 520 })]), { ...off, highestPowerLock: true }, new Set());
    expect(plan.lock.sort()).toEqual(["b", "w2"]);
  });

  it("keeps one inventory slot free without moving protected items", () => {
    const weapons = Array.from({ length: 9 }, (_, index) => weapon(`w${index}`, { locked: index === 0, power: 500 + index }));
    const plan = planLootWatchers(gear([], weapons), { ...off, farmingMode: true }, new Set(["w8"]));
    expect(plan.moveToVault).toEqual(["w8"]);
  });

  it("locks a newly observed tier 5 fit only when that archetype and tuning combination is not already owned", () => {
    const novel = armor("new", { gearTier: 5 });
    expect(planLootWatchers(gear([novel]), { ...off, tier5FitLock: true }, new Set(["new"])).lock).toEqual(["new"]);
    expect(planLootWatchers(gear([armor("old"), novel]), { ...off, tier5FitLock: true }, new Set(["new"])).lock).toEqual([]);
  });

  it("tags inferior duplicate fits but ignores exotics and protected copies", () => {
    const plan = planLootWatchers(gear([armor("old", { baseTotal: 65 }), armor("new", { baseTotal: 75 })]), { ...off, duplicateFitJunk: true }, new Set(["new"]));
    expect(plan.tagJunk).toEqual(["old"]);
    const exotic = [armor("e1", { rarity: "Exotic" }), armor("e2", { rarity: "Exotic" })];
    expect(planLootWatchers(gear(exotic), { ...off, duplicateFitJunk: true }, new Set(["e2"])).tagJunk).toEqual([]);
    expect(planLootWatchers(gear([armor("keep", { tag: "keep", baseTotal: 60 }), armor("new", { baseTotal: 75 })]), { ...off, duplicateFitJunk: true }, new Set(["new"])).tagJunk).toEqual(["new"]);
  });

  it("waits for a baseline before applying fit watchers", () => {
    const plan = planLootWatchers(gear([armor("new", { gearTier: 5 })]), { ...off, tier5FitLock: true, duplicateFitJunk: true }, new Set(["new"]), false);
    expect(plan.lock).toEqual([]);
    expect(plan.tagJunk).toEqual([]);
    expect(plan.skipped[0]).toMatch(/baseline/);
  });
});
