import { describe, expect, it } from "vitest";
import { combineFireteamActivityEntries, fireteamChannelKey, normalizeFireteamMessage, sanitizeSharedRecentEvent } from "./fireteamActivityFeed";

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
});
