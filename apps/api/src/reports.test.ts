import { describe, expect, it } from "vitest";
import { createReportSchema, isReportAdmin, updateReportSchema } from "./reports";

describe("report validation", () => {
  it("accepts structured update feedback and preserves optional diagnostic context", () => {
    expect(createReportSchema.parse({
      category: "bug",
      title: "Rewards progress is stale",
      description: "The Rewards header did not refresh after earning XP.",
      reproductionSteps: "Earn XP, then return to Guardian Nexus.",
      pageUrl: "/rewards",
      clientContext: { viewport: "1920x1080", appPath: "/rewards" }
    })).toMatchObject({ category: "bug", pageUrl: "/rewards", clientContext: { viewport: "1920x1080" } });
  });

  it("rejects empty reports and admin writes without a version or change", () => {
    expect(() => createReportSchema.parse({ category: "bug", title: "Bad", description: "Too short" })).toThrow();
    expect(() => updateReportSchema.parse({ expectedVersion: 1 })).toThrow();
    expect(() => updateReportSchema.parse({ status: "completed", resolution: "Fixed" })).toThrow();
  });

  it("accepts conflict-safe admin changes", () => {
    expect(updateReportSchema.parse({ expectedVersion: 4, priority: "urgent", assignment: "claim" })).toEqual({ expectedVersion: 4, priority: "urgent", assignment: "claim" });
  });
});

describe("report administrators", () => {
  const env = { REPORT_ADMIN_MEMBERSHIP_IDS: "one,two,three" };
  it("uses stable membership IDs instead of display names", () => {
    expect(isReportAdmin("two", env)).toBe(true);
    expect(isReportAdmin("ErebusAres", env)).toBe(false);
  });
});
