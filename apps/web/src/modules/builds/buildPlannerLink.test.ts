import { describe, expect, it } from "vitest";
import { buildPlannerLink } from "./buildPlannerLink";

describe("buildPlannerLink", () => {
  it("opens reviewed field guides by their advisor template id", () => {
    expect(buildPlannerLink({ id: "curated-hunter-void-gyrfalcon", slug: "field-guide-hunter-void-gyrfalcon" }))
      .toBe("/build-advisor?template=hunter-void-gyrfalcon");
  });

  it("opens guardian-authored builds by published slug", () => {
    expect(buildPlannerLink({ id: "build-1", slug: "void-build" })).toBe("/build-advisor?build=void-build");
  });
});
