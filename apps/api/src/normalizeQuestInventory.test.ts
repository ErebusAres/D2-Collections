import { describe, expect, it } from "vitest";
import { questInventoryItems } from "./normalize";

describe("questInventoryItems", () => {
  it("keeps the tracked account-level duplicate", () => {
    const result = questInventoryItems({
      characterInventories: { data: { character: { items: [] } } },
      profileInventory: { data: { items: [
        { itemHash: "quest", state: 0 },
        { itemHash: "quest", state: 2 }
      ] } }
    }, "character");

    expect(result).toEqual([{ itemHash: "quest", state: 2 }]);
  });

  it("prefers the selected character inventory over an account-level duplicate", () => {
    const result = questInventoryItems({
      characterInventories: { data: { character: { items: [{ itemHash: "quest", state: 2 }] } } },
      profileInventory: { data: { items: [{ itemHash: "quest", state: 0 }] } }
    }, "character");

    expect(result).toEqual([{ itemHash: "quest", state: 2 }]);
  });
});
