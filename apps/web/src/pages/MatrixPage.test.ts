import type { MatrixGuardian } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { defaultMatrixSelection } from "./MatrixPage";

const guardians: MatrixGuardian[] = [
  { membershipId: "1", displayName: "FearsRedemption", hasSnapshot: true },
  { membershipId: "2", displayName: "ErebusAres", hasSnapshot: true },
  { membershipId: "3", displayName: "IceeDedPple", hasSnapshot: false }
];

describe("defaultMatrixSelection", () => {
  it("starts each Guardian on their own Matrix", () => {
    expect(defaultMatrixSelection(guardians, "2", [])).toEqual(["2"]);
  });

  it("restores valid comparisons and discards Guardians outside the roster", () => {
    expect(defaultMatrixSelection(guardians, "1", ["1", "3", "not-approved", "3"])).toEqual(["1", "3"]);
  });
});
