import { describe, expect, it } from "vitest";
import {
  authoritativeFireteamV2Party,
  fireteamV2RefreshState,
  fireteamV2RetryAfter,
  fireteamV2SnapshotAdvanced,
  fireteamV2SourceAdvanced,
  fireteamV2SnapshotUsable,
  nextFireteamV2RefreshAt
} from "./fireteamV2";
import { profileComponentsFor } from "./bungie";

describe("Fireteam v2 snapshot contract", () => {
  it("requests roster, player state, tracked quests, and records without gear inventory components", () => {
    expect(profileComponentsFor("fireteam-v2").split(",")).toEqual(expect.arrayContaining(["100", "102", "200", "201", "202", "204", "301", "310", "900", "1000"]));
    expect(profileComponentsFor("fireteam-v2").split(",")).not.toContain("800");
  });
  it("derives the only refresh deadline from the committed snapshot", () => {
    expect(nextFireteamV2RefreshAt("2026-08-20T11:55:00.000Z")).toBe("2026-08-20T12:00:00.000Z");
  });

  it("keeps a five-minute snapshot usable through bounded cron jitter", () => {
    const committed = "2026-08-20T11:55:00.000Z";
    expect(fireteamV2SnapshotUsable(committed, Date.parse("2026-08-20T12:01:14.000Z"))).toBe(true);
    expect(fireteamV2SnapshotUsable(committed, Date.parse("2026-08-20T12:01:16.000Z"))).toBe(false);
  });

  it("does not claim a new cycle until a newer snapshot version commits", () => {
    expect(fireteamV2SnapshotAdvanced(7, 7)).toBe(false);
    expect(fireteamV2SnapshotAdvanced(7, 8)).toBe(true);
  });

  it("rejects repeated or stale Bungie source snapshots instead of moving Last updated", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    expect(fireteamV2SourceAdvanced(undefined, "2026-08-20T11:59:30.000Z", now)).toBe(true);
    expect(fireteamV2SourceAdvanced("2026-08-20T11:59:30.000Z", "2026-08-20T11:59:30.000Z", now)).toBe(false);
    expect(fireteamV2SourceAdvanced("2026-08-20T11:59:30.000Z", "2026-08-20T11:55:00.000Z", now)).toBe(false);
  });

  it("reports due and failed refreshes without inventing a new deadline", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    expect(fireteamV2RefreshState({ committedAt: "2026-08-20T11:55:00.000Z", nextRefreshAt: "2026-08-20T12:00:00.000Z" }, now)).toBe("refreshing");
    expect(fireteamV2RefreshState({ committedAt: "2026-08-20T11:55:00.000Z", nextRefreshAt: "2026-08-20T12:00:00.000Z", lastErrorCode: "worker_resource_limit" }, now)).toBe("delayed");
  });

  it("uses one same-snapshot player state and roster without old-member retention", () => {
    const observed = [
      { membershipId: "self", displayName: "Self", status: 9, observedInParty: true },
      { membershipId: "friend", displayName: "Friend", status: 1, observedInParty: true }
    ];
    expect(authoritativeFireteamV2Party(observed, "self", "online", true)).toEqual(observed);
    expect(authoritativeFireteamV2Party(observed, "self", "offline", true)).toEqual([
      { membershipId: "self", displayName: "Self", status: 0, observedInParty: false }
    ]);
    expect(authoritativeFireteamV2Party(observed, "self", "unknown", true)).toEqual([
      { membershipId: "self", displayName: "Self", status: 0, observedInParty: false }
    ]);
  });

  it("honors an upstream retry delay and otherwise waits at least one minute", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    expect(fireteamV2RetryAfter({}, now)).toBe("2026-08-20T12:01:00.000Z");
    expect(fireteamV2RetryAfter({ retryAfterSeconds: 90 }, now)).toBe("2026-08-20T12:01:30.000Z");
  });
});
