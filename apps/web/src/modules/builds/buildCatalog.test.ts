import type { BuildCatalogChunk, BuildCatalogEntry } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { searchBuildCatalogChunk } from "./buildCatalog";

describe("build catalog search", () => {
  it("keeps Hunter Spirit icons searchable when a saved Relativism hash is outdated", () => {
    const chunk: BuildCatalogChunk = {
      version: "test",
      kind: "exoticSpirit",
      entries: [spirit("30", "Spirit of Caliban", 1), spirit("31", "Spirit of Gyrfalcon", 2), spirit("32", "Spirit of Synthoceps", 2)],
      spiritHashesByClass: {
        hunter: { row1: ["30"], row2: ["31"] },
        titan: { row1: [], row2: ["32"] }
      }
    };

    const results = searchBuildCatalogChunk(chunk, { kind: "exoticSpirit", query: "gyrfalcon", itemHash: "legacy-relativism", classType: "hunter", spiritRow: 2 });

    expect(results).toEqual([expect.objectContaining({ name: "Spirit of Gyrfalcon", icon: "https://www.bungie.net/31.png" })]);
  });

  it("keeps legacy-named Stasis definitions searchable only on Stasis", () => {
    const chunk: BuildCatalogChunk = {
      version: "test",
      kind: "fragment",
      entries: [
        { ...catalogEntry("40", "Whisper of Fissures", "fragment"), subclass: "stasis" },
        { ...catalogEntry("41", "Facet of Courage", "fragment"), subclass: "prismatic" }
      ]
    };

    expect(searchBuildCatalogChunk(chunk, { kind: "fragment", query: "", subclass: "stasis" }).map((entry) => entry.name)).toEqual(["Whisper of Fissures"]);
  });

  it("limits Artifact perks to the selected current Artifact and assigns tiers", () => {
    const chunk: BuildCatalogChunk = {
      version: "test",
      kind: "artifactPerk",
      entries: [catalogEntry("50", "Tier One", "artifactPerk"), catalogEntry("51", "Tier Two", "artifactPerk"), catalogEntry("52", "Other Artifact", "artifactPerk")],
      artifactPerkPools: { "100": { tiers: { "1": ["50"], "2": ["51"], "3": [] }, slots: { "1": 2, "2": 3, "3": 2 } } }
    };

    expect(searchBuildCatalogChunk(chunk, { kind: "artifactPerk", query: "", itemHash: "100" }).map((entry) => [entry.name, entry.artifactTier])).toEqual([["Tier One", 1], ["Tier Two", 2]]);
  });
});

function spirit(hash: string, name: string, row: 1 | 2): BuildCatalogEntry {
  return { hash, name, row, kind: "exoticSpirit", icon: `https://www.bungie.net/${hash}.png`, description: `${name} description`, itemType: "Exotic Intrinsic", rarity: "Exotic", slot: "", damageType: "", exotic: true };
}

function catalogEntry(hash: string, name: string, kind: BuildCatalogEntry["kind"]): BuildCatalogEntry {
  return { hash, name, kind, description: "", icon: `https://www.bungie.net/${hash}.png`, itemType: "", rarity: "", slot: "", damageType: "", exotic: false };
}
