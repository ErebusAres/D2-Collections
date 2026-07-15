import type { MatrixSnapshot } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { matrixGuardianRoster } from "../src/matrix";

const snapshot: MatrixSnapshot = {
  membershipId: "2",
  displayName: "ErebusAres",
  syncedAt: "2026-07-15T12:00:00.000Z",
  manifestVersion: "v1",
  entries: []
};

describe("matrixGuardianRoster", () => {
  it("keeps every approved Guardian visible without allowing one sync to replace another", () => {
    expect(matrixGuardianRoster(
      new Set(["1", "2", "3"]),
      [
        { membershipId: "1", displayName: "FearsRedemption" },
        { membershipId: "2", displayName: "ErebusAres" },
        { membershipId: "3", displayName: "IceeDedPple" }
      ],
      [snapshot],
      { membershipId: "1", displayName: "FearsRedemption" }
    )).toEqual([
      { membershipId: "2", displayName: "ErebusAres", hasSnapshot: true, syncedAt: "2026-07-15T12:00:00.000Z" },
      { membershipId: "1", displayName: "FearsRedemption", hasSnapshot: false },
      { membershipId: "3", displayName: "IceeDedPple", hasSnapshot: false }
    ]);
  });
});
