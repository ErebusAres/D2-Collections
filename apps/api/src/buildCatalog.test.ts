import type { BuildCatalogChunk, BuildCatalogEntry } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { searchBuildCatalog } from "./buildCatalog";

describe("build manifest catalog", () => {
  it("returns only the requested official Guardian class definition", () => {
    const chunk = catalog("class", [entry("0", "Titan", "class", { classType: "titan" }), entry("1", "Hunter", "class", { classType: "hunter" })]);
    expect(searchBuildCatalog(chunk, { kind: "class", q: "", classType: "titan" })).toEqual([expect.objectContaining({ name: "Titan" })]);
  });

  it("filters official subclass and ability definitions by class and subclass", () => {
    const chunk = catalog("subclass", [entry("1", "Prismatic Hunter", "subclass", { classType: "hunter", subclass: "prismatic" }), entry("2", "Prismatic Titan", "subclass", { classType: "titan", subclass: "prismatic" })]);
    expect(searchBuildCatalog(chunk, { kind: "subclass", q: "", classType: "hunter" })).toEqual([expect.objectContaining({ hash: "1", name: "Prismatic Hunter" })]);
  });

  it("uses precomputed slot applicability for armor mods", () => {
    const chunk = catalog("armorMod", [entry("3", "Firepower", "armorMod", { applicableSlots: ["arms"] }), entry("4", "Firepower", "armorMod", { applicableSlots: ["arms"] })]);
    expect(searchBuildCatalog(chunk, { kind: "armorMod", q: "", slot: "arms" }).map((value) => value.name)).toEqual(["Firepower"]);
    expect(searchBuildCatalog(chunk, { kind: "armorMod", q: "", slot: "helmet" })).toEqual([]);
  });

  it("limits exotic class-item Spirits to the selected row", () => {
    const chunk = { ...catalog("exoticSpirit", [entry("30", "Spirit of the Abeyant", "exoticSpirit", { row: 1 }), entry("31", "Spirit of the Horn", "exoticSpirit", { row: 2 })]), spiritHashes: { "100": { row1: ["30"], row2: ["31"] } } };
    expect(searchBuildCatalog(chunk, { kind: "exoticSpirit", q: "", itemHash: "100", spiritRow: 2 }).map((value) => value.name)).toEqual(["Spirit of the Horn"]);
  });

  it("uses the Guardian class Spirit pool for a legacy class-item hash", () => {
    const chunk = {
      ...catalog("exoticSpirit", [entry("30", "Spirit of Caliban", "exoticSpirit", { row: 1 }), entry("31", "Spirit of Gyrfalcon", "exoticSpirit", { row: 2 }), entry("32", "Spirit of Synthoceps", "exoticSpirit", { row: 2 })]),
      spiritHashesByClass: { hunter: { row1: ["30"], row2: ["31"] }, titan: { row1: [], row2: ["32"] } }
    };
    expect(searchBuildCatalog(chunk, { kind: "exoticSpirit", q: "", itemHash: "legacy-hash", classType: "hunter", spiritRow: 2 }).map((value) => value.name)).toEqual(["Spirit of Gyrfalcon"]);
  });

  it("limits searchable roll perks to the selected weapon's real pool", () => {
    const chunk = { ...catalog("weaponPerk", [entry("10", "Incandescent", "weaponPerk"), entry("11", "Headstone", "weaponPerk")]), weaponPerkHashes: { "100": ["10"], "200": ["11"] } };
    expect(searchBuildCatalog(chunk, { kind: "weaponPerk", q: "", itemHash: "100" }).map((value) => value.name)).toEqual(["Incandescent"]);
  });

  it("returns separate two-piece and four-piece set choices", () => {
    const chunk = catalog("armorSetBonus", [
      entry("20", "Luminopotent · 2-piece", "armorSetBonus", { setName: "Luminopotent", requiredPieces: 2 }),
      entry("20", "Luminopotent · 4-piece", "armorSetBonus", { setName: "Luminopotent", requiredPieces: 4 })
    ]);
    expect(searchBuildCatalog(chunk, { kind: "armorSetBonus", q: "luminopotent" }).map((value) => value.requiredPieces)).toEqual([2, 4]);
  });
});

function catalog(kind: BuildCatalogChunk["kind"], entries: BuildCatalogEntry[]): BuildCatalogChunk {
  return { version: "test-manifest", kind, entries };
}

function entry(hash: string, name: string, kind: BuildCatalogEntry["kind"], overrides: Partial<BuildCatalogEntry> = {}): BuildCatalogEntry {
  return { hash, name, kind, description: `${name} description`, icon: `https://www.bungie.net/${hash}.png`, itemType: "", rarity: "", slot: "", damageType: "", exotic: false, ...overrides };
}
