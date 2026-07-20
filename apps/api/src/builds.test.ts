import { describe, expect, it } from "vitest";
import { buildDocumentSchema, buildVoteSchema, parseStoredBuildDocument, ratingFromCounts, slugifyBuildTitle } from "./builds";

const validBuild = {
  title: "Prismatic Support Loop",
  classType: "warlock",
  subclass: "prismatic",
  tags: ["support"],
  activityTags: ["GM"],
  summary: "Keep the fireteam alive.",
  notes: "Rotate abilities safely.",
  links: [],
  subclassConfig: { aspects: [], fragments: [] },
  equipment: { weapons: [], armor: [], armorSets: [] },
  statPriorities: [],
  armorMods: { helmet: [], arms: [], chest: [], legs: [], classItem: [] },
  artifacts: [],
  gameplayLoop: [],
  cosmetics: { ornaments: [] },
  outdated: false,
  changelog: [],
  status: "draft",
  visibility: "private"
};

describe("build validation", () => {
  it("accepts a complete minimal build without inventing optional data", () => {
    expect(buildDocumentSchema.parse({ ...validBuild, concepts: [{ name: "Radiant", hash: "123", icon: "https://www.bungie.net/radiant.png" }] })).toMatchObject({ title: validBuild.title, tags: ["support"], concepts: [{ name: "Radiant", hash: "123" }], championCounters: [] });
  });

  it("requires at least one tag and rejects unsafe links", () => {
    expect(() => buildDocumentSchema.parse({ ...validBuild, tags: [] })).toThrow();
    expect(() => buildDocumentSchema.parse({ ...validBuild, links: [{ kind: "dim", label: "DIM", url: "not-a-url" }] })).toThrow();
  });

  it("enforces Destiny's two equipped Aspect sockets", () => {
    expect(() => buildDocumentSchema.parse({
      ...validBuild,
      subclassConfig: { aspects: [{ name: "One" }, { name: "Two" }, { name: "Three" }], fragments: [] }
    })).toThrow();
  });

  it("limits stat priority to the fixed six ranks", () => {
    expect(() => buildDocumentSchema.parse({
      ...validBuild,
      statPriorities: [{ stat: "Health", priority: 7 }]
    })).toThrow();
  });

  it("allows duplicate armor mods as quantities while enforcing three sockets per piece", () => {
    expect(buildDocumentSchema.parse({
      ...validBuild,
      armorMods: { ...validBuild.armorMods, arms: [{ name: "Radiant Light", quantity: 1 }, { name: "Dynamo", quantity: 2 }] }
    }).armorMods.arms).toEqual([{ name: "Radiant Light", quantity: 1 }, { name: "Dynamo", quantity: 2 }]);
    expect(() => buildDocumentSchema.parse({
      ...validBuild,
      armorMods: { ...validBuild.armorMods, arms: [{ name: "Dynamo", quantity: 3 }, { name: "Radiant Light", quantity: 1 }] }
    })).toThrow();
  });

  it("accepts only explicit 2 + 2 or matching 2 + 4 armor set selections", () => {
    const twoPiece = { name: "Ionic Overclock", setName: "Luminopotent", requiredPieces: 2 };
    expect(buildDocumentSchema.parse({
      ...validBuild,
      equipment: { ...validBuild.equipment, armorSets: [twoPiece, { name: "Shock and Clear", setName: "Luminopotent", requiredPieces: 4 }] }
    }).equipment.armorSets).toHaveLength(2);
    expect(buildDocumentSchema.parse({
      ...validBuild,
      equipment: { ...validBuild.equipment, armorSets: [twoPiece, { name: "Techsec bonus", setName: "Techsec", requiredPieces: 2 }] }
    }).equipment.armorSets).toHaveLength(2);
    expect(() => buildDocumentSchema.parse({
      ...validBuild,
      equipment: { ...validBuild.equipment, armorSets: [twoPiece, { name: "Wrong four", setName: "Techsec", requiredPieces: 4 }] }
    })).toThrow(/Armor sets must be/);
    expect(() => buildDocumentSchema.parse({
      ...validBuild,
      equipment: { ...validBuild.equipment, armorSets: [{ name: "Four only", setName: "Luminopotent", requiredPieces: 4 }] }
    })).toThrow(/Armor sets must be/);
  });

  it("limits each selected Artifact to seven equipped perks", () => {
    expect(() => buildDocumentSchema.parse({
      ...validBuild,
      artifacts: [{ name: "Tablet of Ruin", perks: Array.from({ length: 8 }, (_, index) => ({ name: `Perk ${index + 1}` })) }]
    })).toThrow();
  });

  it("accepts all seven current Artifacts and validates progressive perk slots", () => {
    const artifacts = Array.from({ length: 7 }, (_, index) => ({
      name: `Artifact ${index + 1}`,
      perks: index === 0 ? [
        { name: "Tier One", hash: "1", artifactTier: 1, artifactSlot: 1 },
        { name: "Tier Two", hash: "2", artifactTier: 2, artifactSlot: 3 },
        { name: "Tier Three", hash: "3", artifactTier: 3, artifactSlot: 6 }
      ] : []
    }));
    expect(buildDocumentSchema.parse({ ...validBuild, artifacts }).artifacts).toHaveLength(7);
    expect(() => buildDocumentSchema.parse({
      ...validBuild,
      artifacts: [{ name: "Artifact", perks: [{ name: "Too early", hash: "3", artifactTier: 3, artifactSlot: 1 }] }]
    })).toThrow(/accepts Tier 1 or lower/);
    expect(() => buildDocumentSchema.parse({
      ...validBuild,
      artifacts: [{ name: "Artifact", perks: [{ name: "One", hash: "1", artifactTier: 1, artifactSlot: 1 }, { name: "Duplicate", hash: "1", artifactTier: 1, artifactSlot: 2 }] }]
    })).toThrow(/cannot be selected more than once/);
  });

  it("does not expose stale Transcendence data on non-Prismatic stored builds", () => {
    const stored = { ...validBuild, subclass: "solar", subclassConfig: { ...validBuild.subclassConfig, transcendence: { name: "Transcendence", hash: "3696633656", icon: "https://www.bungie.net/transcendence.png" } } };
    expect(parseStoredBuildDocument(JSON.stringify(stored)).subclassConfig.transcendence).toBeUndefined();
  });

  it("reads and canonicalizes builds saved before the stricter set and Artifact rules", () => {
    const legacy = {
      ...validBuild,
      equipment: {
        ...validBuild.equipment,
        armorSets: [{
          name: "Luminopotent · 2 + 4-piece",
          setName: "Luminopotent",
          requiredPieces: 4,
          bonuses: [
            { name: "Ionic Overclock", setName: "Luminopotent", requiredPieces: 2 },
            { name: "Shock and Clear", setName: "Luminopotent", requiredPieces: 4 }
          ]
        }]
      },
      artifacts: [{ name: "Tablet of Ruin", perks: Array.from({ length: 9 }, (_, index) => ({ name: `Perk ${index + 1}` })) }]
    };
    const parsed = parseStoredBuildDocument(JSON.stringify(legacy));
    expect(parsed.equipment.armorSets.map((entry) => entry.requiredPieces)).toEqual([2, 4]);
    expect(parsed.artifacts[0]?.perks).toHaveLength(7);
    expect(parsed.artifacts[0]?.perks[6]?.name).toBe("Perk 7");
  });
});

describe("build presentation helpers", () => {
  it("accepts upvotes, downvotes, and an explicit abstention", () => {
    expect(buildVoteSchema.parse({ vote: "up" })).toEqual({ vote: "up" });
    expect(buildVoteSchema.parse({ vote: "down" })).toEqual({ vote: "down" });
    expect(buildVoteSchema.parse({ vote: null })).toEqual({ vote: null });
  });

  it("creates stable URL-safe title stems", () => {
    expect(slugifyBuildTitle("  Saint's Solar Support!  ")).toBe("saint-s-solar-support");
  });

  it("reports neutral and voted ratings without fabricated percentages", () => {
    expect(ratingFromCounts(0, 0)).toEqual({ upvotes: 0, downvotes: 0, total: 0, score: 0, percentPositive: undefined });
    expect(ratingFromCounts(3, 1)).toEqual({ upvotes: 3, downvotes: 1, total: 4, score: 2, percentPositive: 75 });
  });
});
