import type { WeaponItem } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { evaluateWeapon } from "./weaponEvaluator";

const weapon = { itemHash: "1", rollDataState: "complete", perkColumns: [{ socketIndex: 1, active: { hash: "10", name: "Test", description: "" }, options: [] }] } as unknown as WeaponItem;
describe("weapon evaluator", () => {
  it("does not turn an absent community record into a bad score", () => { const result = evaluateWeapon(weapon); expect(result.state).toBe("unavailable"); expect(result.overall).toBeUndefined(); });
  it("keeps incomplete Bungie roll data distinct", () => expect(evaluateWeapon({ ...weapon, rollDataState: "partial" })).toMatchObject({ state: "incomplete" }));
});
