import { describe, expect, it } from "vitest";
import type { BuildCatalogEntry, BuildNamedEntry } from "@guardian-nexus/contracts";
import { resolveArtifactPerkSlots, serializeArtifactPerkSlots } from "./artifactSlots";

const catalog = ([1, 2, 3] as const).map((artifactTier) => ({
  hash: String(artifactTier),
  name: `Tier ${artifactTier}`,
  description: "",
  icon: "",
  itemType: "Artifact Perk",
  rarity: "",
  slot: "",
  damageType: "",
  kind: "artifactPerk" as const,
  exotic: false,
  artifactTier
})) satisfies BuildCatalogEntry[];

describe("Artifact 2.0 perk slots", () => {
  it("places perks only in progressively unlocked slot tiers", () => {
    const slots = resolveArtifactPerkSlots([
      { name: "Tier 3", hash: "3" },
      { name: "Tier 2", hash: "2" },
      { name: "Tier 1", hash: "1" }
    ], catalog);
    expect(slots.find((slot) => slot.perk?.hash === "1")?.slot).toBe(1);
    expect(slots.find((slot) => slot.perk?.hash === "2")?.slot).toBe(3);
    expect(slots.find((slot) => slot.perk?.hash === "3")?.slot).toBe(6);
  });

  it("repairs incompatible legacy positions and removes duplicate perks", () => {
    const values: BuildNamedEntry[] = [
      { name: "Tier 3", hash: "3", artifactTier: 3, artifactSlot: 1 },
      { name: "Tier 3 duplicate", hash: "3", artifactTier: 3, artifactSlot: 7 }
    ];
    const serialized = serializeArtifactPerkSlots(resolveArtifactPerkSlots(values, catalog));
    expect(serialized).toEqual([{ name: "Tier 3", hash: "3", artifactTier: 3, artifactSlot: 6 }]);
  });

  it("preserves a valid explicitly selected slot", () => {
    const serialized = serializeArtifactPerkSlots(resolveArtifactPerkSlots([
      { name: "Tier 1", hash: "1", artifactTier: 1, artifactSlot: 7 }
    ], catalog));
    expect(serialized[0]?.artifactSlot).toBe(7);
  });
});
