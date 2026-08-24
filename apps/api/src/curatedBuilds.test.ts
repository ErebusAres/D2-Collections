import { describe, expect, it } from "vitest";
import { buildDocumentSchema } from "./builds";
import { curatedBuildByIdentifier, curatedBuilds } from "./curatedBuilds";

describe("curated build library", () => {
  it("publishes every reviewed primary template as a complete read-only field guide", () => {
    const builds = curatedBuilds();
    expect(builds.length).toBeGreaterThanOrEqual(18);
    for (const build of builds) {
      const document = structuredClone(build) as unknown as Record<string, unknown>;
      for (const key of ["id", "slug", "authorMembershipId", "authorDisplayName", "rating", "viewerVote", "canEdit", "canVote", "createdAt", "updatedAt", "publishedAt"]) delete document[key];
      expect(() => buildDocumentSchema.parse(document)).not.toThrow();
      expect(build.canVote).toBe(false);
      expect(build.notes).toContain("How this build works");
      expect(build.gameplayLoop.length).toBeGreaterThan(0);
      expect(build.equipment.weapons).toHaveLength(3);
      expect(build.subclassConfig.aspects.length).toBeGreaterThan(0);
      expect(build.statPriorities).toHaveLength(6);
    }
  });

  it("resolves a field guide by stable id or slug", () => {
    const build = curatedBuilds()[0]!;
    expect(curatedBuildByIdentifier(build.id)?.slug).toBe(build.slug);
    expect(curatedBuildByIdentifier(build.slug)?.id).toBe(build.id);
  });
});
