import type { BuildAdvisorRecommendation } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { buildTrackingItem, parseTrackedBuilds } from "./buildTracking";

describe("Build Advisor Fireteam tracking", () => {
  it("keeps unknown requirements distinct from missing and includes acquisition steps", () => {
    const recommendation = {
      templateId: "hunter-void-test", name: "Test build", classType: "hunter", subclass: "void", status: "missing-one-important-item", readinessScore: 50,
      reason: "A test plan", missingItems: ["Required Exotic"],
      componentVerifications: [
        { id: "owned", kind: "weapon", name: "Owned weapon", state: "exact-owned", required: true, reasons: [], actions: [] },
        { id: "unknown", kind: "weapon", name: "Unknown weapon", state: "unknown", required: true, reasons: [], actions: [] }
      ],
      acquisitionPlans: [{ id: "plan", componentId: "unknown", name: "Unknown weapon", targetTraits: { required: [], preferred: [], acceptable: [] }, trackingKey: "plan", routes: [{ id: "route", label: "Route", description: "Get it", source: "activity", availability: "available-now", certainty: "random", steps: ["Complete the activity."], prerequisites: [] }] }]
    } as unknown as BuildAdvisorRecommendation;
    const item = buildTrackingItem(recommendation, "2026-08-02T00:00:00.000Z");
    expect(item).toMatchObject({ kind: "build", percent: 50, trackedInDestiny: false });
    expect(item.objectives).toEqual([
      expect.objectContaining({ name: "Owned weapon", complete: true, progressAvailable: true }),
      expect.objectContaining({ name: "Unknown weapon", complete: false, progressAvailable: false })
    ]);
    expect(item.acquisitionGuide?.steps).toEqual(["Complete the activity."]);
    expect(parseTrackedBuilds(JSON.stringify([item]))).toHaveLength(1);
  });
});
