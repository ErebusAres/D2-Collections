import type { ArmorItem, GearData, LootWatcherConfig, WeaponItem } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { planLootWatchers } from "./lootWatchers";

const off: LootWatcherConfig = { farmingMode: false, highestPowerLock: false, tier5FitLock: false, duplicateFitJunk: false };
const armor = (instanceId: string, values: Partial<ArmorItem> = {}): ArmorItem => ({
  instanceId, itemHash: instanceId, name: "Aion Adapter", icon: "", className: "Warlock", slot: "Helmet", rarity: "Legendary", power: 500,
  ownerCharacterId: "c1", location: "vault", equipped: false, locked: false, masterworked: false, gearTier: 4,
  archetype: { hash: "paragon", name: "Paragon", description: "" }, tunedStat: "grenade", setBonuses: [], perks: [],
  baseStats: { health: 25, melee: 0, grenade: 20, super: 0, class: 0, weapons: 30 }, currentStats: { health: 25, melee: 0, grenade: 20, super: 0, class: 0, weapons: 30 },
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

  it("locks only newly looted items that set a strictly higher Power for their slot", () => {
    const plan = planLootWatchers(gear([armor("a", { power: 500 }), armor("b", { power: 510 })], [weapon("w1", { power: 505 }), weapon("w2", { power: 520 })]), { ...off, highestPowerLock: true }, new Set(["b", "w2"]));
    expect(plan.lock.sort()).toEqual(["b", "w2"]);
    expect(planLootWatchers(gear([], [weapon("old", { power: 520 }), weapon("tie", { power: 520 })]), { ...off, highestPowerLock: true }, new Set(["tie"])).lock).toEqual([]);
    expect(planLootWatchers(gear([], [weapon("old", { power: 520 })]), { ...off, highestPowerLock: true }, new Set()).lock).toEqual([]);
  });

  it("keeps one inventory slot free without moving protected items", () => {
    const weapons = Array.from({ length: 9 }, (_, index) => weapon(`w${index}`, { locked: index === 0, power: 500 + index }));
    const plan = planLootWatchers(gear([], weapons), { ...off, farmingMode: true }, new Set(["w8"]));
    expect(plan.moveToVault).toEqual(["w8"]);
  });

  it("locks a newly observed tier 5 fit only when that piece, archetype, and tuning combination is not already owned at tier 5", () => {
    const novel = armor("new", { gearTier: 5 });
    expect(planLootWatchers(gear([novel]), { ...off, tier5FitLock: true }, new Set(["new"])).lock).toEqual(["new"]);
    expect(planLootWatchers(gear([armor("old", { gearTier: 5, name: "Different Set" }), novel]), { ...off, tier5FitLock: true }, new Set(["new"])).lock).toEqual([]);
    expect(planLootWatchers(gear([armor("old", { gearTier: 4 }), novel]), { ...off, tier5FitLock: true }, new Set(["new"])).lock).toEqual(["new"]);
  });

  it("tags only newly looted inferior duplicate or unfit armor and skips protected pieces", () => {
    const plan = planLootWatchers(gear([armor("old", { baseTotal: 75 }), armor("new", { baseTotal: 65 })]), { ...off, duplicateFitJunk: true }, new Set(["new"]));
    expect(plan.tagJunk).toEqual(["new"]);
    const upgrade = planLootWatchers(gear([armor("old", { baseTotal: 65 }), armor("new", { baseTotal: 75 })]), { ...off, duplicateFitJunk: true }, new Set(["new"]));
    expect(upgrade.tagJunk).toEqual([]);
    const unfit = armor("unfit", { tunedStat: "melee" });
    expect(planLootWatchers(gear([unfit]), { ...off, duplicateFitJunk: true }, new Set(["unfit"])).tagJunk).toEqual(["unfit"]);
    const exotic = [armor("e1", { rarity: "Exotic" }), armor("e2", { rarity: "Exotic" })];
    expect(planLootWatchers(gear(exotic), { ...off, duplicateFitJunk: true }, new Set(["e2"])).tagJunk).toEqual([]);
    expect(planLootWatchers(gear([armor("old", { baseTotal: 75 }), armor("new", { tag: "archive", baseTotal: 60 })]), { ...off, duplicateFitJunk: true }, new Set(["new"])).tagJunk).toEqual([]);
  });

  it("uses Destiny Recipes' current archetype and bonus-stat fit matrix", () => {
    const matrix = {
      Brawler: ["weapons", "class", "grenade", "super"], Bulwark: ["weapons", "grenade", "super", "melee"],
      Colossus: ["weapons", "class", "grenade", "melee"], Demolitionist: ["weapons", "health", "super", "melee"],
      Grenadier: ["weapons", "health", "class", "melee"], Gunner: ["health", "class", "super", "melee"],
      Paragon: ["weapons", "health", "class", "grenade"], Powerhouse: ["health", "class", "grenade", "melee"],
      Reaver: ["weapons", "health", "grenade", "super"], Siegebreaker: ["weapons", "class", "super", "melee"],
      Skirmisher: ["health", "class", "grenade", "super"], Specialist: ["health", "grenade", "super", "melee"]
    } as const;
    for (const [name, allowed] of Object.entries(matrix)) {
      const fit = armor(`${name}-fit`, { archetype: { hash: name, name, description: "" }, tunedStat: allowed[0] });
      const unfitStat = (["health", "melee", "grenade", "super", "class", "weapons"] as const).find((stat) => !allowed.includes(stat as never))!;
      const unfit = armor(`${name}-unfit`, { archetype: { hash: name, name, description: "" }, tunedStat: unfitStat });
      expect(planLootWatchers(gear([fit, unfit]), { ...off, duplicateFitJunk: true }, new Set([fit.instanceId, unfit.instanceId])).tagJunk).toEqual([unfit.instanceId]);
    }
  });

  it("waits for a baseline before applying fit watchers", () => {
    const plan = planLootWatchers(gear([armor("new", { gearTier: 5 })]), { ...off, tier5FitLock: true, duplicateFitJunk: true }, new Set(["new"]), false);
    expect(plan.lock).toEqual([]);
    expect(plan.tagJunk).toEqual([]);
    expect(plan.skipped[0]).toMatch(/baseline/);
    expect(planLootWatchers(gear([], [weapon("new", { power: 550 })]), { ...off, highestPowerLock: true }, new Set(["new"]), false).lock).toEqual([]);
  });
});
