import { describe, expect, it } from "vitest";
import { parseRedeemedCodes, redeemedCodesStorageKey } from "./rewardCodePreferences";

describe("reward code preferences", () => {
  it("scopes redeemed codes to the signed-in membership", () => {
    expect(redeemedCodesStorageKey("member-1")).toBe("guardian-nexus:member-1:redeemed-codes");
    expect(redeemedCodesStorageKey()).toBe("guardian-nexus:anonymous:redeemed-codes");
  });

  it("ignores malformed and non-string stored values", () => {
    expect([...parseRedeemedCodes('["AAA",42,"BBB"]')]).toEqual(["AAA", "BBB"]);
    expect([...parseRedeemedCodes("not-json")]).toEqual([]);
  });
});
