import { describe, expect, it } from "vitest";
import { destinyDisplayName } from "../src/bungie";

describe("destinyDisplayName", () => {
  it("formats Bungie's public global display name and discriminator", () => {
    expect(destinyDisplayName({ bungieGlobalDisplayName: "Guardian", bungieGlobalDisplayNameCode: 42 })).toBe("Guardian#0042");
    expect(destinyDisplayName({ displayName: "PlatformGuardian" })).toBe("PlatformGuardian");
  });
});
