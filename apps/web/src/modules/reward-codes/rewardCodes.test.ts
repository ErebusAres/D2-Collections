import { describe, expect, it } from "vitest";
import { activeRewardCodes, featuredRewardCodes, rewardCodeRedemptionUrl, rewardCodes } from "./rewardCodes";

describe("reward code catalog", () => {
  it("keeps the marquee limited to active featured codes", () => {
    const now = new Date("2026-07-15T00:00:00Z");
    const featured = featuredRewardCodes(now);

    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((entry) => entry.featured && (!entry.expiresAt || Date.parse(entry.expiresAt) > now.getTime()))).toBe(true);
  });

  it("excludes documented expired codes from the active catalog", () => {
    const active = activeRewardCodes(new Date("2026-07-15T00:00:00Z"));

    expect(rewardCodes.some((entry) => entry.code === "ARR-RRR-RRR")).toBe(true);
    expect(active.some((entry) => entry.code === "ARR-RRR-RRR")).toBe(false);
  });

  it("prefills Bungie's official redemption route with the selected code", () => {
    expect(rewardCodeRedemptionUrl("9FY-KDD-PRT")).toBe("https://www.bungie.net/7/en/Codes/Redeem?token=9FY-KDD-PRT");
  });
});
