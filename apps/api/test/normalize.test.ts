import { describe, expect, it } from "vitest";
import type { CompactManifest } from "@guardian-nexus/contracts";
import { activityName } from "../src/normalize";

const manifest = {
  version: "test",
  generatedAt: "now",
  items: [],
  itemDefinitions: {},
  objectiveDefinitions: {},
  activityDefinitions: {
    "42": { displayProperties: { name: "A Story Mission" } },
    "99": { displayProperties: { name: "A Transitory Activity" } }
  },
  recordDefinitions: {}
} satisfies CompactManifest;

describe("activityName", () => {
  it("falls back to the selected character activity when transitory data is missing", () => {
    const profile = { characterActivities: { data: { c1: { currentActivityHash: 42 } } } };
    expect(activityName(profile, manifest, "c1")).toBe("A Story Mission");
  });

  it("prefers Bungie's transitory current activity when both sources resolve", () => {
    const profile = {
      profileTransitoryData: { data: { currentActivity: { activityHash: 99 } } },
      characterActivities: { data: { c1: { currentActivityHash: 42 } } }
    };
    expect(activityName(profile, manifest, "c1")).toBe("A Transitory Activity");
  });
});
