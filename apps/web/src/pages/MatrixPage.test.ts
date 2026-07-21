import type { MatrixGuardian } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { defaultMatrixSelection, matrixRowsForPage } from "./MatrixPage";

const guardians: MatrixGuardian[] = [
  { membershipId: "1", displayName: "FearsRedemption", hasSnapshot: true },
  { membershipId: "2", displayName: "ErebusAres", hasSnapshot: true },
  { membershipId: "3", displayName: "IceeDedPple", hasSnapshot: false }
];

describe("defaultMatrixSelection", () => {
  it("starts with every approved Guardian in the comparison", () => {
    expect(defaultMatrixSelection(guardians, "2", [])).toEqual(["1", "2", "3"]);
  });

  it("restores valid comparisons and discards Guardians outside the roster", () => {
    expect(defaultMatrixSelection(guardians, "1", ["1", "3", "not-approved", "3"])).toEqual(["1", "3"]);
  });
});

describe("matrixRowsForPage", () => {
  it("renders a bounded initial batch instead of the entire Matrix", () => {
    const rows = Array.from({ length: 240 }, (_, index) => index);
    expect(matrixRowsForPage(rows, 80)).toEqual(rows.slice(0, 80));
    expect(matrixRowsForPage(rows, 160)).toEqual(rows.slice(0, 160));
  });
});
