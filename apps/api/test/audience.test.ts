import { describe, expect, it } from "vitest";
import { canViewAudienceMetrics, validVisitorToken } from "../src/audience";

describe("audience visitor identity", () => {
  it("accepts only bounded random browser identifiers", () => {
    expect(validVisitorToken("0123456789_abcdefghij-ABCDEF")).toBe(true);
    expect(validVisitorToken("short")).toBe(false);
    expect(validVisitorToken("visitor token with spaces")).toBe(false);
    expect(validVisitorToken(undefined)).toBe(false);
  });

  it("exposes counters only to a configured membership ID", () => {
    expect(canViewAudienceMetrics("corey", "corey,matt,chris")).toBe(true);
    expect(canViewAudienceMetrics("visitor", "corey,matt,chris")).toBe(false);
  });
});
