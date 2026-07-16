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
    expect(buildDocumentSchema.parse(validBuild)).toMatchObject({ title: validBuild.title, tags: ["support"] });
  });

  it("requires at least one tag and rejects unsafe links", () => {
    expect(() => buildDocumentSchema.parse({ ...validBuild, tags: [] })).toThrow();
    expect(() => buildDocumentSchema.parse({ ...validBuild, links: [{ kind: "dim", label: "DIM", url: "not-a-url" }] })).toThrow();
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
