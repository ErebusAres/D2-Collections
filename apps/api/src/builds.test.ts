import { describe, expect, it } from "vitest";
import { buildDocumentSchema, parseStoredBuildDocument, ratingFromCounts, slugifyBuildTitle } from "./builds";

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
  it("creates stable URL-safe title stems", () => {
    expect(slugifyBuildTitle("  Saint's Solar Support!  ")).toBe("saint-s-solar-support");
  });

  it("reports neutral and voted ratings without fabricated percentages", () => {
    expect(ratingFromCounts(0, 0)).toEqual({ upvotes: 0, downvotes: 0, total: 0, score: 0, percentPositive: undefined });
    expect(ratingFromCounts(3, 1)).toEqual({ upvotes: 3, downvotes: 1, total: 4, score: 2, percentPositive: 75 });
  });
});
