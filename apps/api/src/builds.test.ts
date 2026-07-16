import { describe, expect, it } from "vitest";
import { buildDocumentSchema, ratingFromCounts, slugifyBuildTitle } from "./builds";

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
