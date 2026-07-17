import { describe, expect, it } from "vitest";
import { nextBuildVote } from "./BuildRating";

describe("nextBuildVote", () => {
  it("toggles the selected vote back to abstain", () => {
    expect(nextBuildVote("up", "up")).toBeNull();
    expect(nextBuildVote("down", "down")).toBeNull();
  });

  it("casts or switches to the newly selected vote", () => {
    expect(nextBuildVote(undefined, "up")).toBe("up");
    expect(nextBuildVote("up", "down")).toBe("down");
    expect(nextBuildVote("down", "up")).toBe("up");
  });
});
