import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { addArmorSetSelection, armorSetOptionAllowed, normalizeArmorSetSelections } from "./armorSetBonuses";

const bonus = (setName: string, requiredPieces: 2 | 4, name = `${setName} ${requiredPieces}`): BuildNamedEntry => ({
  hash: setName === "Luminopotent" ? "10" : "20",
  name,
  setName,
  requiredPieces,
  itemType: `${requiredPieces}-piece Set Bonus`
});

describe("armor set selections", () => {
  it("expands a legacy cumulative set entry into explicit two-piece and four-piece bonuses", () => {
    const selected = normalizeArmorSetSelections([{
      hash: "10",
      name: "Luminopotent · 2 + 4-piece",
      setName: "Luminopotent",
      requiredPieces: 4,
      bonuses: [bonus("Luminopotent", 2, "Ionic Overclock"), bonus("Luminopotent", 4, "Shock and Clear")]
    }]);
    expect(selected).toEqual([
      expect.objectContaining({ name: "Ionic Overclock", requiredPieces: 2 }),
      expect.objectContaining({ name: "Shock and Clear", requiredPieces: 4 })
    ]);
  });

  it("allows two different two-piece bonuses", () => {
    const first = bonus("Luminopotent", 2);
    const second = bonus("Techsec", 2);
    expect(armorSetOptionAllowed([first], second)).toBe(true);
    expect(addArmorSetSelection([first], second)).toEqual([first, second]);
  });

  it("only allows a four-piece bonus after the matching two-piece bonus", () => {
    const first = bonus("Luminopotent", 2);
    expect(armorSetOptionAllowed([], bonus("Luminopotent", 4))).toBe(false);
    expect(armorSetOptionAllowed([first], bonus("Techsec", 4))).toBe(false);
    expect(armorSetOptionAllowed([first], bonus("Luminopotent", 4))).toBe(true);
  });
});
