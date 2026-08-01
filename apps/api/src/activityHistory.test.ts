import { describe, expect, it } from "vitest";
import { normalizeActivityHistory } from "./activityHistory";

const row = (instanceId: string, period: string, mode: number, referenceId = 123) => ({ characterId: "hunter", activity: { period, activityDetails: { instanceId, mode, modes: [mode], referenceId }, values: { completed: { basic: { value: 1 } }, activityDurationSeconds: { basic: { value: 900 } }, kills: { basic: { value: 20 } } } } });

describe("activity history normalization", () => {
  it("deduplicates, sorts, resolves definitions, and preserves optional stats", () => {
    const data = normalizeActivityHistory({ rows: [row("old", "2026-07-31T00:00:00Z", 3), row("new", "2026-08-01T00:00:00Z", 5), row("new", "2026-08-01T00:00:00Z", 5)], characterClasses: { hunter: "Hunter" }, activityDefinitions: { "123": { displayProperties: { name: "Test Arena", description: "A test." } } }, manifestVersion: "v1", returnedCharacters: 1, totalCharacters: 1 });
    expect(data.state).toBe("available");
    expect(data.activities.map((entry) => entry.instanceId)).toEqual(["new", "old"]);
    expect(data.activities[0]).toMatchObject({ activityName: "Test Arena", kind: "pvp", characterClass: "Hunter", completed: true, kills: 20 });
  });

  it("reports partial and unavailable states without inventing rows", () => {
    expect(normalizeActivityHistory({ rows: [], characterClasses: {}, activityDefinitions: {}, manifestVersion: "unavailable", returnedCharacters: 1, totalCharacters: 2 }).state).toBe("partial");
    expect(normalizeActivityHistory({ rows: [], characterClasses: {}, activityDefinitions: {}, manifestVersion: "unavailable", returnedCharacters: 0, totalCharacters: 2 })).toMatchObject({ state: "unavailable", activities: [] });
  });
});
