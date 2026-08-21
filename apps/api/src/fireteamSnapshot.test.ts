import { describe, expect, it } from "vitest";
import {
  authoritativeFireteamParty,
  FIRETEAM_MAX_REFRESHES_PER_CRON,
  fireteamRefreshState,
  fireteamRetryAfter,
  fireteamSharedQuests,
  fireteamSnapshotAdvanced,
  fireteamSourceAdvanced,
  fireteamSnapshotUsable,
  nextFireteamRefreshAt
} from "./fireteamSnapshot";
import { profileComponentsFor } from "./bungie";

describe("Fireteam snapshot contract", () => {
  it("requests every component used by the one canonical snapshot", () => {
    expect(profileComponentsFor("fireteam").split(",")).toEqual(expect.arrayContaining(["100", "102", "200", "201", "202", "204", "205", "300", "301", "304", "305", "307", "310", "800", "900", "1000"]));
  });

  it("keeps enough bounded cron capacity for a normal multi-member Fireteam", () => {
    expect(FIRETEAM_MAX_REFRESHES_PER_CRON).toBeGreaterThanOrEqual(6);
    expect(FIRETEAM_MAX_REFRESHES_PER_CRON).toBeLessThanOrEqual(12);
  });
  it("derives the only refresh deadline from the committed snapshot", () => {
    expect(nextFireteamRefreshAt("2026-08-20T11:55:00.000Z")).toBe("2026-08-20T12:00:00.000Z");
  });

  it("keeps a five-minute snapshot usable through bounded cron jitter", () => {
    const committed = "2026-08-20T11:55:00.000Z";
    expect(fireteamSnapshotUsable(committed, Date.parse("2026-08-20T12:01:14.000Z"))).toBe(true);
    expect(fireteamSnapshotUsable(committed, Date.parse("2026-08-20T12:01:16.000Z"))).toBe(false);
  });

  it("does not claim a new cycle until a newer snapshot version commits", () => {
    expect(fireteamSnapshotAdvanced(7, 7)).toBe(false);
    expect(fireteamSnapshotAdvanced(7, 8)).toBe(true);
  });

  it("commits every active Seasonal Hub Order while keeping other pursuits opt-in", () => {
    const quests = [
      pursuit("tracked-quest", "quest", true),
      pursuit("hub-order", "order", false),
      pursuit("private-quest", "quest", false)
    ];

    const shared = fireteamSharedQuests(quests, new Set(["tracked-quest"]));

    expect(shared.map((quest) => quest.instanceId)).toEqual(["tracked-quest", "hub-order"]);
    expect(shared.every((quest) => quest.steps === undefined)).toBe(true);
  });

  it("rejects repeated or stale Bungie source snapshots instead of moving Last updated", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    expect(fireteamSourceAdvanced(undefined, "2026-08-20T11:59:30.000Z", now)).toBe(true);
    expect(fireteamSourceAdvanced("2026-08-20T11:59:30.000Z", "2026-08-20T11:59:30.000Z", now)).toBe(false);
    expect(fireteamSourceAdvanced("2026-08-20T11:59:30.000Z", "2026-08-20T11:55:00.000Z", now)).toBe(false);
  });

  it("reports due and failed refreshes without inventing a new deadline", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    expect(fireteamRefreshState({ committedAt: "2026-08-20T11:55:00.000Z", nextRefreshAt: "2026-08-20T12:00:00.000Z" }, now)).toBe("refreshing");
    expect(fireteamRefreshState({ committedAt: "2026-08-20T11:55:00.000Z", nextRefreshAt: "2026-08-20T12:00:00.000Z", lastErrorCode: "worker_resource_limit" }, now)).toBe("delayed");
  });

  it("uses one same-snapshot player state and roster without old-member retention", () => {
    const observed = [
      { membershipId: "self", displayName: "Self", status: 9, observedInParty: true },
      { membershipId: "friend", displayName: "Friend", status: 1, observedInParty: true }
    ];
    expect(authoritativeFireteamParty(observed, "self", "online", true)).toEqual(observed);
    expect(authoritativeFireteamParty(observed, "self", "offline", true)).toEqual([
      { membershipId: "self", displayName: "Self", status: 0, observedInParty: false }
    ]);
    expect(authoritativeFireteamParty(observed, "self", "unknown", true)).toEqual([
      { membershipId: "self", displayName: "Self", status: 0, observedInParty: false }
    ]);
  });

  it("honors an upstream retry delay and otherwise waits at least one minute", () => {
    const now = Date.parse("2026-08-20T12:00:00.000Z");
    expect(fireteamRetryAfter({}, now)).toBe("2026-08-20T12:01:00.000Z");
    expect(fireteamRetryAfter({ retryAfterSeconds: 90 }, now)).toBe("2026-08-20T12:01:30.000Z");
  });
});

function pursuit(instanceId: string, category: "quest" | "order", inGameTracked: boolean) {
  return {
    instanceId,
    itemHash: `hash-${instanceId}`,
    name: instanceId,
    description: "Snapshot pursuit",
    icon: "",
    currentStep: "Complete the objective",
    characterId: "character-1",
    inGameTracked,
    sitePinned: false,
    isExoticUnlock: false,
    rewards: [],
    objectives: [{ objectiveHash: `objective-${instanceId}`, name: "Progress", progress: 1, completionValue: 5, complete: false, percent: 20 }],
    steps: [{ itemHash: "step", stepNumber: 1, name: "Step", description: "Do it", status: "current" as const, objectives: [], percent: 0, progressKnown: true }],
    percent: 20,
    updatedAt: "2026-08-20T12:00:00.000Z",
    category
  };
}
