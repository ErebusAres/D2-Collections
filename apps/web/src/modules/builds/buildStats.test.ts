import type { BuildStatPriority } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { buildStatValueLabels, defaultBuildStatPriorities } from "./buildStats";

const stat = (values: Partial<BuildStatPriority>): BuildStatPriority => ({ stat: "Grenade", priority: 1, ...values });

describe("buildStatValueLabels", () => {
  it("uses the requested default Builder priority order", () => {
    expect(defaultBuildStatPriorities().map(({ stat, priority }) => ({ stat, priority }))).toEqual([
      { stat: "Grenade", priority: 1 },
      { stat: "Super", priority: 2 },
      { stat: "Class", priority: 3 },
      { stat: "Weapons", priority: 4 },
      { stat: "Melee", priority: 5 },
      { stat: "Health", priority: 6 }
    ]);
  });

  it("uses compact range, minimum, target, and any notation", () => {
    expect(buildStatValueLabels(stat({ minimum: 40, maximum: 80 }))).toEqual([{ text: "40–80", target: false }]);
    expect(buildStatValueLabels(stat({ minimum: 70 }))).toEqual([{ text: "70+", target: false }]);
    expect(buildStatValueLabels(stat({ target: 100 }))).toEqual([{ text: "100", target: true }]);
    expect(buildStatValueLabels(stat({}))).toEqual([{ text: "Any", target: false }]);
  });

  it("collapses a zero range to a single zero", () => {
    expect(buildStatValueLabels(stat({ minimum: 0, maximum: 0 }))).toEqual([{ text: "0", target: false }]);
    expect(buildStatValueLabels(stat({ maximum: 0 }))).toEqual([{ text: "0", target: false }]);
  });
});
