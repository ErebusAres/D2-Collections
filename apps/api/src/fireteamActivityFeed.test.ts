import { describe, expect, it } from "vitest";
import { combineFireteamActivityEntries, configuredFireteamActivityFeedEnabled, fireteamActivitySnapshotEnabled, fireteamChannelKey, normalizeFireteamMessage, sanitizeSharedRecentEvent, sharedActivityFeedEnabled, sharedRecentEventFromRow } from "./fireteamActivityFeed";

describe("Fireteam activity feed", () => {
  it("uses one stable channel key for the same party regardless of order", async () => {
    expect(await fireteamChannelKey(["2", "1", "2"])).toBe(await fireteamChannelKey(["1", "2"]));
  });

  it("normalizes short messages without accepting hidden control characters", () => {
    expect(normalizeFireteamMessage("  Ready\n\tto go!  ")).toBe("Ready to go!");
    expect(normalizeFireteamMessage("x".repeat(300))).toHaveLength(240);
  });

  it("orders newest first and enforces the bounded history", () => {
    const entry = (id: string, createdAt: string): any => ({ type: "message", id, membershipId: "1", displayName: "Guardian", body: id, createdAt });
    expect(combineFireteamActivityEntries([entry("old", "2026-08-08T10:00:00Z"), entry("new", "2026-08-08T11:00:00Z")], 1)).toEqual([expect.objectContaining({ id: "new" })]);
  });

  it("removes private item state before a gear find is shared", () => {
    const event: any = { id: "loot", kind: "weapon-found", sourceKey: "gear:1", name: "Test", icon: "", quantity: 1, observedAt: "2026-08-08T10:00:00Z", lastObservedAt: "2026-08-08T10:00:00Z", gear: { kind: "weapon", tag: "favorite", dismissedAt: "later", ownerCharacterId: "private", instanceId: "1" } };
    expect(sanitizeSharedRecentEvent(event).gear).toEqual({ kind: "weapon", instanceId: "1" });
  });

  it("rehydrates legacy gear events from current observations before privacy stripping", () => {
    const row = {
      id: "legacy", event_kind: "weapon-found", source_key: "gear:1", item_hash: "10", instance_id: "1", name: "Test", description: "", icon: "", quantity: 1,
      observed_at: "2026-08-08T10:00:00Z", last_observed_at: "2026-08-08T10:00:00Z",
      metadata_json: JSON.stringify({ name: "Test" }),
      observation_metadata_json: JSON.stringify({ gear: { kind: "weapon", instanceId: "1", gearTier: 4, tag: "favorite", ownerCharacterId: "private" } })
    };
    expect(sharedRecentEventFromRow(row).gear).toEqual({ kind: "weapon", instanceId: "1", gearTier: 4 });
  });

  it("migrates legacy opt-in false values to enabled while preserving an explicit disable", () => {
    expect(sharedActivityFeedEnabled({})).toBe(true);
    expect(sharedActivityFeedEnabled({ activityFeedEnabled: false })).toBe(true);
    expect(sharedActivityFeedEnabled({ activityFeedEnabled: false, activityFeedPreferenceSet: true })).toBe(false);
    expect(sharedActivityFeedEnabled({ activityFeedEnabled: true, activityFeedPreferenceSet: true })).toBe(true);
  });

  it("applies the saved preference immediately without waiting for a new snapshot", () => {
    expect(configuredFireteamActivityFeedEnabled('{"activityFeedEnabled":false}', { activityFeedEnabled: true, activityFeedPreferenceSet: true })).toBe(false);
    expect(configuredFireteamActivityFeedEnabled('{"activityFeedEnabled":true}', { activityFeedEnabled: false, activityFeedPreferenceSet: true })).toBe(true);
    expect(configuredFireteamActivityFeedEnabled("malformed", { activityFeedEnabled: false, activityFeedPreferenceSet: true })).toBe(false);
  });

  it("keeps the viewer's saved feed available while stale teammate feeds remain private", () => {
    expect(fireteamActivitySnapshotEnabled(true, false, true)).toBe(true);
    expect(fireteamActivitySnapshotEnabled(false, false, true)).toBe(false);
    expect(fireteamActivitySnapshotEnabled(false, true, true)).toBe(true);
    expect(fireteamActivitySnapshotEnabled(true, true, false)).toBe(false);
  });
});
