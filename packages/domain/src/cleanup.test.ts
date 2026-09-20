import { describe, expect, it } from "vitest";
import type { ArmorItem, GearData, WeaponItem } from "@guardian-nexus/contracts";
import { analyzeCleanup, CLEANUP_DEFAULTS, type CleanupWishlist } from "./cleanup";

function armor(id: string, extra: Partial<ArmorItem> = {}): ArmorItem {
  return { instanceId: id, itemHash: "100", name: "Armor", icon: "", className: "Warlock", slot: "Helmet", rarity: "Legendary", power: 500, location: "vault", equipped: false, locked: false, masterworked: false, gearTier: 5, setBonuses: [], perks: [], baseStats: { health: 10, melee: 10, grenade: 10, super: 10, class: 10, weapons: 10 }, currentStats: { health: 10, melee: 10, grenade: 10, super: 10, class: 10, weapons: 10 }, adjustments: [], baseTotal: 60, currentTotal: 60, grade: { letter: "A" }, firstSeenAt: "now", isNew: false, ...extra };
}
function weapon(id: string, extra: Partial<WeaponItem> = {}): WeaponItem {
  return { instanceId: id, itemHash: "200", name: "Weapon", icon: "", itemType: "Sword", slot: "Power", damageType: "Solar", rarity: "Legendary", power: 500, location: "vault", equipped: false, locked: false, masterworked: false, gearTier: 5, crafted: false, enhanced: false, perkColumns: [0, 1, 2, 3, 4].map((socketIndex) => ({ socketIndex, ratingColumn: socketIndex < 4 ? socketIndex as 0 | 1 | 2 | 3 : undefined, kind: socketIndex === 4 ? "origin" : "trait", options: [], selectablePlugHashes: [String(socketIndex + 10)] })), originTraits: [], stats: [{ hash: "1", name: "Impact", value: 60, maximumValue: 100 }], rollDataState: "complete", reviewState: "configured", reviewReasons: [], duplicateCount: 2, wishlisted: false, firstSeenAt: "now", isNew: false, ...extra };
}
function gear(items: ArmorItem[] = [], weapons: WeaponItem[] = []): GearData {
  return { items, weapons, manifestVersion: "1", selectedCharacterId: "1", selectedClass: "Warlock", statIcons: {}, totals: { armor: items.length, vault: items.length + weapons.length, equipped: 0, locked: 0, grouped: 0, newItems: 0 } };
}
const scan = (data: GearData, extra = {}, saved = new Set<string>(), complete = true, sources: CleanupWishlist[] = []) => analyzeCleanup(data, { ...CLEANUP_DEFAULTS, ...extra }, saved, complete, sources);

describe("cleanup safety", () => {
  it("preserves one deterministic keeper for identical copies even at the Power cap", () => {
    const result = scan(gear([armor("1"), armor("2"), armor("3")]));
    expect(result.recommendations.map((r) => r.itemId).sort()).toEqual(["2", "3"]);
    expect(result.recommendations.every((r) => r.keeperId === "1" && r.confidence === 99)).toBe(true);
  });
  it("uses all available weapon options, including origin traits, not hypothetical catalog options", () => {
    const a = weapon("1"), b = weapon("2");
    expect(scan(gear([], [a, b])).recommendations).toHaveLength(1);
    b.perkColumns[4]!.selectablePlugHashes = ["999"];
    expect(scan(gear([], [a, b])).recommendations).toHaveLength(0);
    b.perkColumns = structuredClone(a.perkColumns);
    b.perkColumns[0]!.options = [{ hash: "888", name: "Hypothetical", description: "" }];
    expect(scan(gear([], [a, b])).recommendations).toHaveLength(1);
  });
  it.each(["Sword", "Combat Bow", "Bow"])("compares complete physical %s rolls", (itemType) => {
    expect(scan(gear([], [weapon("1", { itemType }), weapon("2", { itemType })])).recommendations[0]?.confidence).toBe(99);
  });
  it("recognizes a strict physical option superset without discarding unique attachments", () => {
    const keeper = weapon("1"), candidate = weapon("2");
    keeper.perkColumns[0]!.selectablePlugHashes!.push("extra-blade");
    expect(scan(gear([], [keeper, candidate])).recommendations[0]).toMatchObject({ itemId: "2", keeperId: "1", confidence: 95 });
    candidate.perkColumns[1]!.selectablePlugHashes!.push("unique-guard");
    expect(scan(gear([], [keeper, candidate])).recommendations).toEqual([]);
  });
  it("refuses missing sockets or account protection data", () => {
    expect(scan(gear([], [weapon("1"), weapon("2", { rollDataState: "partial" })])).recommendations).toEqual([]);
    expect(scan(gear([armor("1"), armor("2")]), {}, new Set(), false).insufficient).toHaveLength(2);
  });
  it.each([{ locked: true }, { equipped: true }, { tag: "keep" as const }, { rarity: "Exotic" }])("keeps protected gear review-only", (protection) => {
    const result = scan(gear([armor("1"), armor("2", protection)]), { aggressive: true });
    expect(result.recommendations.filter((r) => r.itemId === "2").every((r) => !r.actionable)).toBe(true);
  });
  it("protects saved builds and crafted investment", () => {
    expect(scan(gear([armor("1"), armor("2")]), {}, new Set(["1", "2"])).recommendations).toEqual([]);
    expect(scan(gear([], [weapon("1", { crafted: true }), weapon("2", { crafted: true })])).recommendations).toEqual([]);
  });
  it("does not compare different armor fits or classes", () => {
    expect(scan(gear([armor("1"), armor("2", { className: "Titan" })])).recommendations).toEqual([]);
    expect(scan(gear([armor("1"), armor("2", { tunedStat: "health" })])).recommendations).toEqual([]);
  });
  it("requires genuine stat dominance, not a larger total", () => {
    const a = armor("1", { baseStats: { ...armor("1").baseStats, grenade: 20 } });
    expect(scan(gear([a, armor("2")])).recommendations[0]?.confidence).toBe(95);
    const b = armor("2", { baseStats: { ...armor("2").baseStats, health: 20 } });
    expect(scan(gear([a, b])).recommendations).toEqual([]);
    expect(scan(gear([a, b]), { aggressive: true, preferences: true, priorities: { ...CLEANUP_DEFAULTS.priorities, health: 0 } }).recommendations[0]?.confidence).toBe(70);
  });
  it("never tags keepers or recommends character items by default", () => {
    const data = gear([armor("1", { location: "inventory", ownerCharacterId: "char" }), armor("2"), armor("3")]);
    const result = scan(data).recommendations;
    const candidates = new Set(result.map((r) => r.itemId));
    expect(result.every((r) => !candidates.has(r.keeperId))).toBe(true);
    expect(candidates.has("1")).toBe(false);
  });
  it("does not treat missing or disagreeing wishlists as negative evidence", () => {
    const a = weapon("1"), b = weapon("2"); b.perkColumns[2]!.selectablePlugHashes = ["99"];
    const bucket = { recommendations: 1, columns: [["10"], ["11"], ["12"], ["13"]], traitPairs: ["12,13"] };
    const source: CleanupWishlist = { id: "voltron", name: "Test", reviewedAt: "now", items: { "200": { pve: bucket, pvp: bucket } } };
    const settings = { aggressive: true, preferences: true };
    expect(scan(gear([], [a, b]), settings).recommendations).toEqual([]);
    expect(scan(gear([], [a, b]), settings, new Set(), true, [source]).recommendations[0]?.confidence).toBe(70);
    const other = { ...source, id: "choosy-voltron", items: { "200": { pve: { ...bucket, traitPairs: ["99,13"] }, pvp: { ...bucket, traitPairs: ["99,13"] } } } };
    expect(scan(gear([], [a, b]), { ...settings, sources: ["voltron", "choosy-voltron"] }, new Set(), true, [source, other]).recommendations).toEqual([]);
  });
});
