import { describe, expect, it } from "vitest";
import { emptyBuildDocument } from "./builds";
import { exportPortableBuild, parsePortableBuild, portableBuildFilename } from "./portableBuild";

describe("portable builds", () => {
  it("exports an account-neutral private draft and imports it safely", () => {
    const document = { ...emptyBuildDocument(), title: "Solar Support", tags: ["support"] };
    const build = { ...document, id: "build-1", slug: "solar-support", authorMembershipId: "private-id", authorDisplayName: "Guardian", rating: { upvotes: 9, downvotes: 0, total: 9, score: 9 }, canEdit: true, createdAt: "now", updatedAt: "now" };
    const envelope = exportPortableBuild(build, "2026-08-01T20:00:00.000Z");
    expect(JSON.stringify(envelope)).not.toContain("private-id");
    expect(JSON.stringify(envelope)).not.toContain("upvotes");
    expect(parsePortableBuild(JSON.stringify(envelope))).toMatchObject({ title: "Solar Support", status: "draft", visibility: "private" });
  });

  it("rejects unsupported files and produces stable filenames", () => {
    expect(() => parsePortableBuild('{"schemaVersion":2}')).toThrow(/not a supported/);
    expect(portableBuildFilename("Saint's Solar Support!")).toBe("saint-s-solar-support.guardian-nexus.json");
  });
});
