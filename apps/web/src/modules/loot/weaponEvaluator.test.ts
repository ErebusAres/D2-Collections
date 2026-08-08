import type { WeaponItem } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import database from "../../../public/data/weapon-value.v2.json";
import { evaluateWeapon, type WeaponRatingDatabase } from "./weaponEvaluator";

const ratings = database as WeaponRatingDatabase;

const weapon = { itemHash: "1", rollDataState: "complete", perkColumns: [{ socketIndex: 1, active: { hash: "10", name: "Test", description: "" }, options: [] }] } as unknown as WeaponItem;
describe("weapon evaluator", () => {
  it("does not turn an absent community record into a bad score", () => { const result = evaluateWeapon(weapon, ratings); expect(result.state).toBe("unavailable"); expect(result.overall).toBeUndefined(); });
  it("keeps incomplete Bungie roll data distinct", () => expect(evaluateWeapon({ ...weapon, rollDataState: "partial" }, ratings)).toMatchObject({ state: "incomplete" }));
  it("scores a source-backed recommended trait pair without claiming universal truth", () => {
    const reviewed = { ...weapon, itemHash: "877384", perkColumns: ["839105230", "106909392", "3824105627", "1134488199"].map((hash, socketIndex) => ({ socketIndex, active: { hash, name: hash, description: "" }, options: [] })) } as unknown as WeaponItem;
    const result = evaluateWeapon(reviewed, ratings);
    expect(result).toMatchObject({ state: "scored", pve: 100 });
    expect(result.source).toContain("DIM");
  });
});
