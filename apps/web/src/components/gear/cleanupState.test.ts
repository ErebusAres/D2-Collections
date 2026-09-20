import { describe, expect, it } from "vitest";
import { cleanupSettingsKey, updateCleanupCache } from "./cleanupState";
describe("cleanup UI state", () => {
  it("ignores object insertion order, but detects real setting changes", () => {
    expect(cleanupSettingsKey({ b: 2, a: { d: 4, c: 3 } })).toBe(cleanupSettingsKey({ a: { c: 3, d: 4 }, b: 2 }));
    expect(cleanupSettingsKey({ b: 2 })).not.toBe(cleanupSettingsKey({ b: 3 }));
  });
  it("updates gear and timeline badges without changing manual tags or another Guardian's marks", () => {
    const value = { data: { events: [{ gear: { instanceId: "1", tag: "keep" } }, { gear: { instanceId: "2", cleanupRecommendation: { batchId: "old" } } }, { gear: { instanceId: "other", cleanupRecommendation: { batchId: "theirs" } } }] } };
    const mark = { batchId: "new", confidence: 99, reason: "Exact copy" };
    const updated = updateCleanupCache(value, { "1": mark }, new Set(["1", "2"])) as typeof value;
    expect(updated.data.events[0]?.gear).toMatchObject({ tag: "keep", cleanupRecommendation: mark });
    expect(updated.data.events[1]?.gear.cleanupRecommendation).toBeUndefined();
    expect(updated.data.events[2]?.gear.cleanupRecommendation).toEqual({ batchId: "theirs" });
    expect(value.data.events[1]?.gear.cleanupRecommendation).toEqual({ batchId: "old" });
  });
});
