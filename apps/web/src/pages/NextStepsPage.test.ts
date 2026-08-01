import { describe, expect, it } from "vitest";
import { fireteamRouteTargets, planSession, type SuggestedGoal } from "./NextStepsPage";

function goal(id: string, overrides: Partial<SuggestedGoal> = {}): SuggestedGoal {
  return {
    id,
    title: id,
    detail: "Test objective",
    context: "Test",
    percent: 0,
    to: "/next",
    effortMinutes: 30,
    group: "either",
    kind: "quest",
    reasons: ["Test"],
    effortConfidence: "medium",
    effortReason: "Test estimate",
    overlapKeys: [],
    trackKind: "quest",
    trackId: id,
    ...overrides
  };
}

describe("Next Steps session planner", () => {
  it("fits the highest-value goals into the available time", () => {
    const result = planSession([
      goal("long", { effortMinutes: 120, percent: 90 }),
      goal("near", { percent: 90 }),
      goal("tracked", { quest: { inGameTracked: true } as SuggestedGoal["quest"] }),
      goal("low", { percent: 5 })
    ], 60, "either", "any");
    expect(result.map((entry) => entry.id)).toEqual(["tracked", "near"]);
    expect(result.reduce((total, entry) => total + entry.effortMinutes, 0)).toBeLessThanOrEqual(60);
  });

  it("respects Fireteam and goal-focus preferences", () => {
    const result = planSession([
      goal("solo-exotic", { group: "solo", kind: "exotic" }),
      goal("team-exotic", { group: "fireteam", kind: "exotic" }),
      goal("team-quest", { group: "fireteam", kind: "quest", percent: 99 })
    ], 60, "fireteam", "exotic");
    expect(result.map((entry) => entry.id)).toEqual(["team-exotic"]);
  });

  it("prefers compatible objectives that share progress requirements", () => {
    const result = planSession([
      goal("anchor", { percent: 90, overlapKeys: ["Vanguard"] }),
      goal("shared", { percent: 5, overlapKeys: ["Vanguard"] }),
      goal("isolated", { percent: 45, overlapKeys: ["Crucible"] })
    ], 60, "either", "any");
    expect(result.map((entry) => entry.id)).toEqual(["anchor", "shared"]);
  });

  it("raises objectives with a known near-term deadline", () => {
    const result = planSession([
      goal("normal", { percent: 50 }),
      goal("expiring", { deadlineAt: new Date(Date.now() + 60 * 60_000).toISOString() })
    ], 30, "either", "any");
    expect(result[0]?.id).toBe("expiring");
  });

  it("separates a route into the existing private Fireteam tracking channels", () => {
    expect(fireteamRouteTargets([
      goal("quest", { trackKind: "quest", trackId: "quest-1" }),
      goal("rank", { trackKind: "guardian-rank", trackId: "rank-1" }),
      goal("exotic", { trackKind: "collection", trackId: "item-1" }),
      goal("duplicate", { trackKind: "quest", trackId: "quest-1" })
    ])).toEqual({ questIds: ["quest-1"], rankIds: ["rank-1"], collectionIds: ["item-1"] });
  });
});
