import { describe, expect, it } from "vitest";
import { applyGearSearchSuggestion, gearSearchSuggestions, matchesGearSearch } from "./gearSearch";

const item = { name: "High-Minded Complex", instanceId: "123", className: "Warlock", slot: "Helmet", rarity: "Legendary", location: "vault", tag: "keep", locked: true, equipped: false, masterworked: true, gearTier: 5, power: 550, archetype: { name: "Paragon" }, tunedStat: "grenade", setBonuses: [{ name: "Techsec", active: true }], perks: [], baseStats: { health: 12, melee: 10, grenade: 24, super: 10, class: 10, weapons: 10 }, baseTotal: 76, currentTotal: 86, grade: { letter: "S" }, isNew: false } as any;

describe("gear smart search", () => {
  it("supports DIM-style states, aliases, numeric comparisons, phrases, and negation", () => {
    expect(matchesGearSearch(item, "isrank:s isarchetype:paragon is:grouped basetotal:>=75 -is:equipped", { groupId: "1A" })).toBe(true);
    expect(matchesGearSearch(item, 'name:"high-minded complex" set:techsec grenade:>=20')).toBe(true);
    expect(matchesGearSearch(item, "is:exotic")).toBe(false);
  });

  it("offers dynamic completions and replaces only the active token", () => {
    expect(gearSearchSuggestions("isarchetype:p", [item], ["1A"])[0]?.value).toBe("isarchetype:paragon");
    expect(applyGearSearchSuggestion("is:locked gro", "group:1A")).toBe("is:locked group:1A ");
  });
});
