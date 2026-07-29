import { describe, expect, it } from "vitest";
import type { NotificationCategory } from "@guardian-nexus/contracts";
import { categoryFor, notificationCategoryConfig } from "./categoryConfig";

describe("notification category configuration", () => {
  it("provides a visual and timing contract for every supported category", () => {
    const categories: NotificationCategory[] = [
      "distortion", "crucible", "trials", "iron-banner", "gambit", "vanguard", "exotic", "legendary",
      "seasonal", "eververse", "bungie-news", "completion", "warning", "outage", "redemption-code", "system"
    ];
    expect(Object.keys(notificationCategoryConfig).sort()).toEqual([...categories].sort());
    categories.forEach((category) => {
      const config = categoryFor(category);
      expect(config.label).toBeTruthy();
      expect(config.icon).toBeTruthy();
      expect(config.defaultAutoDismissMs).toBeGreaterThanOrEqual(8_000);
      expect(config.backgroundGradient).toContain("gradient");
    });
  });
});
