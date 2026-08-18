import type { WeaponItem } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import database from "../../../public/data/weapon-value.v4.json";
import { evaluateWeapon, evaluateWeaponTrait, qualityFor, type WeaponRatingDatabase } from "./weaponEvaluator";

const ratings = database as unknown as WeaponRatingDatabase;

function weapon(itemHash: string, perks: string[], itemType = "Pulse Rifle"): WeaponItem {
  return {
    itemHash, itemType, rollDataState: "complete",
    perkColumns: perks.map((hash, socketIndex) => ({ socketIndex, active: { hash, name: hash, description: "" }, options: [] }))
  } as unknown as WeaponItem;
}

describe("weapon evaluator", () => {
  it("scores known partial columns provisionally and lowers confidence until Bungie fills the roll", () => {
    const partial = weapon("877384", ["3824105627", "1134488199"]);
    partial.rollDataState = "partial";
    partial.perkColumns[0]!.ratingColumn = 2;
    partial.perkColumns[1]!.ratingColumn = 3;
    const result = evaluateWeapon(partial, ratings);
    expect(result).toMatchObject({ state: "scored", pve: 100, pvp: 50, overall: 75, confidence: "low", basis: "weapon", comparedColumns: 2, totalColumns: 4 });
    expect(result.reasons.join(" ")).toMatch(/provisional.*update/i);
  });

  it("keeps a roll pending only when no active rating perk is known", () => {
    const pending = weapon("877384", []);
    pending.rollDataState = "unavailable";
    expect(evaluateWeapon(pending, ratings)).toMatchObject({ state: "incomplete" });
  });

  it("scores an exact DIM-backed roll by its actual weighted columns", () => {
    const result = evaluateWeapon(weapon("877384", ["839105230", "106909392", "3824105627", "1134488199"]), ratings);
    expect(result).toMatchObject({ state: "scored", pve: 100, pvp: 50, overall: 75, quality: "strong", confidence: "high", basis: "weapon" });
    expect(result.source).toContain("DIM");
  });

  it("uses equal column weights while preserving the recommended trait pairing", () => {
    const result = evaluateWeapon(weapon("877384", ["900000001", "900000002", "3824105627", "1134488199"]), ratings);
    expect(result).toMatchObject({ state: "scored", pve: 50, pvp: 25, overall: 38, quality: "weak" });
  });

  it("does not award a perfect score to traits borrowed from different recommended combinations", () => {
    const synthetic: WeaponRatingDatabase = {
      schemaVersion: 4, reviewedAt: "2026-08-08", source: { name: "DIM" }, method: { columnWeights: [1, 1, 1, 1] },
      coverage: { manifestWeapons: 1, reviewedWeapons: 1, supportedTypes: 1, reviewedTypes: 1 }, types: {},
      items: { "42": { itemType: "Pulse Rifle", pve: { recommendations: 2, columns: [[], [], ["a", "c"], ["b", "d"]], traitPairs: ["a,b", "c,d"] }, pvp: { recommendations: 0, columns: [[], [], [], []], traitPairs: [] } } }
    };
    expect(evaluateWeapon(weapon("42", ["a", "d"]), synthetic)).toMatchObject({ state: "scored", pve: 50, overall: 50 });
  });

  it("uses API-provided rating positions and ignores non-wishlist sockets", () => {
    const reviewed = weapon("877384", ["999999999", "839105230", "106909392", "3824105627", "1134488199"]);
    reviewed.perkColumns.forEach((column, index) => { if (index > 0) column.ratingColumn = (index - 1) as 0 | 1 | 2 | 3; });
    expect(evaluateWeapon(reviewed, ratings)).toMatchObject({ state: "scored", pve: 100, pvp: 50, overall: 75, quality: "strong" });
  });

  it("can explicitly identify a poor roll when the exact weapon was reviewed", () => {
    const result = evaluateWeapon(weapon("877384", ["900000001", "900000002", "900000003", "900000004"]), ratings);
    expect(result).toMatchObject({ state: "scored", overall: 0, quality: "poor", confidence: "high" });
  });

  it("uses labeled weapon-type evidence instead of inventing an exact review", () => {
    const result = evaluateWeapon(weapon("999999999", ["839105230", "106909392", "3824105627", "1134488199"]), ratings);
    expect(result.state).toBe("scored");
    expect(result).toMatchObject({ basis: "weapon-type" });
    expect(result.confidence).not.toBe("high");
  });

  it("prefers reviewed versions of the same named weapon before broad type evidence", () => {
    const synthetic: WeaponRatingDatabase = {
      schemaVersion: 4, reviewedAt: "2026-08-10", source: { name: "DIM" }, method: { columnWeights: [1, 1, 1, 1] },
      coverage: { manifestWeapons: 2, reviewedWeapons: 1, supportedTypes: 1, reviewedTypes: 1 }, items: {}, types: {},
      families: { "Pulse Rifle::reissued rifle": { pve: { weapons: 1, columns: [{}, {}, { a: 100 }, { b: 100 }] }, pvp: { weapons: 0, columns: [{}, {}, {}, {}] } } }
    };
    const reissue = weapon("new-hash", ["a", "b"]);
    reissue.name = "Reissued Rifle";
    expect(evaluateWeapon(reissue, synthetic)).toMatchObject({ state: "scored", overall: 100, basis: "weapon-family", confidence: "low" });
  });

  it("does not turn absent evidence into a bad score", () => {
    const result = evaluateWeapon(weapon("999999999", ["900000001", "900000002", "900000003", "900000004"], "Unknown weapon"), ratings);
    expect(result.state).toBe("unavailable");
    expect(result.overall).toBeUndefined();
  });

  it("maps stable score thresholds to player-facing quality tiers", () => {
    expect([100, 89, 74, 49, 24].map(qualityFor)).toEqual(["excellent", "strong", "mixed", "weak", "poor"]);
  });

  it("rates every selectable trait against exact DIM recommendations, not only the active trait", () => {
    const candidate = weapon("877384", ["900000003", "900000004"]);
    candidate.perkColumns[0]!.ratingColumn = 2;
    candidate.perkColumns[1]!.ratingColumn = 3;

    expect(evaluateWeaponTrait(candidate, 2, "3824105627", ratings)).toMatchObject({
      state: "scored", pve: 100, pvp: 0, overall: 50, recommended: true, basis: "weapon", confidence: "high", pvePairings: 2
    });
    expect(evaluateWeaponTrait(candidate, 2, "900000003", ratings)).toMatchObject({
      state: "scored", pve: 0, pvp: 0, overall: 0, recommended: false, basis: "weapon"
    });
  });

  it("keeps absent broad trait evidence unrated instead of calling it bad", () => {
    const candidate = weapon("999999999", ["900000003", "900000004"]);
    expect(evaluateWeaponTrait(candidate, 2, "not-in-catalog", ratings)).toMatchObject({ state: "unavailable", recommended: false });
  });
});
