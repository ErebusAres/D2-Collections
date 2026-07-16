import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { addArmorSetSelection, armorSetOptionAllowed, normalizeArmorSetSelections } from "./buildArmorSets";

const bonus = (setName: string, requiredPieces: 2 | 4, name = `${setName} ${requiredPieces}`): BuildNamedEntry => ({
  hash: setName === "Luminopotent" ? "10" : "20",
  name,
  setName,
  requiredPieces,
  itemType: `${requiredPieces}-piece Set Bonus`
});

describe("armor set selections", () => {
  it("expands a legacy cumulative set entry into explicit bonuses", () => {
    expect(normalizeArmorSetSelections([{
      hash: "10",
      name: "Luminopotent · 2 + 4-piece",
      setName: "Luminopotent",
      requiredPieces: 4,
      bonuses: [bonus("Luminopotent", 2, "Ionic Overclock"), bonus("Luminopotent", 4, "Shock and Clear")]
    }])).toEqual([
      expect.objectContaining({ name: "Ionic Overclock", requiredPieces: 2 }),
      expect.objectContaining({ name: "Shock and Clear", requiredPieces: 4 })
    ]);
  });

  it("allows either different two-piece bonuses or a matching four-piece bonus", () => {
    const first = bonus("Luminopotent", 2);
    expect(armorSetOptionAllowed([first], bonus("Techsec", 2))).toBe(true);
    expect(armorSetOptionAllowed([first], bonus("Techsec", 4))).toBe(false);
    expect(addArmorSetSelection([first], bonus("Luminopotent", 4))).toHaveLength(2);
  });
});
