import { describe, expect, it } from "vitest";
import { planSession, type SuggestedGoal } from "./NextStepsPage";

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
});
