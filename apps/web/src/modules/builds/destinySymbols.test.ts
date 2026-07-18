import { describe, expect, it } from "vitest";
import { destinySymbol, searchDestinySymbols } from "./destinySymbols";

describe("Destiny symbol registry", () => {
  it("resolves requested shorthand and Champion synonyms without a network request", () => {
    expect(destinySymbol("arc")?.name).toBe("Arc");
    expect(destinySymbol("power")?.icon).toBe("/icons/destiny/power.svg");
    expect(destinySymbol("overcharge")?.name).toBe("Overload Champion");
    expect(destinySymbol("shield")?.name).toBe("Barrier Champion");
  });

  it("uses the selected class's official Prismatic icon", () => {
    expect(destinySymbol("prismatic", "hunter")?.name).toBe("Prismatic Hunter");
    expect(destinySymbol("prismatic", "warlock")?.name).toBe("Prismatic Warlock");
    expect(destinySymbol("prismatic", "hunter")?.icon).not.toBe(destinySymbol("prismatic", "warlock")?.icon);
  });

  it("searches aliases and related in-game terminology", () => {
    expect(searchDestinySymbols("disrupt", "titan").map((entry) => entry.alias)).toEqual(["overload"]);
    expect(searchDestinySymbols("rift", "warlock").map((entry) => entry.alias)).toEqual(["class"]);
  });
});
