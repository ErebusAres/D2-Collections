import { describe, expect, it } from "vitest";
import { emptyBuildDocument } from "./builds";
import { buildCompletion } from "./buildCompletion";

describe("build completion", () => {
  it("separates required attention from optional sections", () => {
    const empty = buildCompletion(emptyBuildDocument());
    expect(empty.find((entry) => entry.id === "basics")?.state).toBe("needs-attention");
    expect(empty.find((entry) => entry.id === "artifact")?.state).toBe("optional");
    const ready = buildCompletion({ ...emptyBuildDocument(), title: "Ready build", tags: ["endgame"] });
    expect(ready.find((entry) => entry.id === "review")?.state).toBe("complete");
  });
});
