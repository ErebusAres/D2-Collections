import { describe, expect, it } from "vitest";
import { fireteamPresenceRefreshDue, fireteamSocialCacheState, guardianSessionCacheState, mapWithConcurrency, offlineViewerParty, resolvePartyObservation, resolveViewerPartyObservation, visiblePartyMembers } from "./fireteamReliability";

describe("Fireteam reliability helpers", () => {
  it("classifies fresh, stale-usable, expired, and missing social data", () => {
    const now = Date.parse("2026-08-08T20:00:00.000Z");
    expect(fireteamSocialCacheState(undefined, now)).toBe("missing");
    expect(fireteamSocialCacheState("2026-08-08T19:55:00.000Z", now)).toBe("fresh");
    expect(fireteamSocialCacheState("2026-08-08T19:00:00.000Z", now)).toBe("stale");
    expect(fireteamSocialCacheState("2026-08-07T18:00:00.000Z", now)).toBe("expired");
  });

  it("classifies account snapshots separately from social data", () => {
    const now = Date.parse("2026-08-09T06:00:00.000Z");
    expect(guardianSessionCacheState(undefined, now)).toBe("missing");
    expect(guardianSessionCacheState("2026-08-09T05:59:00.000Z", now)).toBe("fresh");
    expect(guardianSessionCacheState("2026-08-09T05:00:00.000Z", now)).toBe("stale");
    expect(guardianSessionCacheState("2026-08-08T05:00:00.000Z", now)).toBe("expired");
  });

  it("requires three consecutive solo observations before collapsing a saved Fireteam", () => {
    const self = { membershipId: "1", displayName: "Self", status: 1, observedInParty: false };
    const teammate = { membershipId: "2", displayName: "Teammate", status: 1, observedInParty: true };
    expect(resolvePartyObservation([self], [self, teammate], false, 1)).toEqual({ members: [self, teammate], consecutiveSoloObservations: 1 });
    expect(resolvePartyObservation([self], [self, teammate], true, 0)).toEqual({ members: [self, { ...teammate, observedInParty: false }], consecutiveSoloObservations: 1 });
    expect(resolvePartyObservation([self], [self, teammate], true, 1)).toEqual({ members: [self, { ...teammate, observedInParty: false }], consecutiveSoloObservations: 2 });
    expect(resolvePartyObservation([self], [self, teammate], true, 2)).toEqual({ members: [self], consecutiveSoloObservations: 0 });
    expect(resolvePartyObservation([self, teammate], [self], true, 2)).toEqual({ members: [self, teammate], consecutiveSoloObservations: 0 });
  });

  it("refreshes Fireteam presence on the live-page cadence", () => {
    const now = Date.parse("2026-08-09T12:00:00.000Z");
    expect(fireteamPresenceRefreshDue(undefined, now)).toBe(true);
    expect(fireteamPresenceRefreshDue("2026-08-09T11:59:01.000Z", now)).toBe(false);
    expect(fireteamPresenceRefreshDue("2026-08-09T11:59:00.000Z", now)).toBe(true);
  });

  it("collapses a stale Bungie party immediately when the viewer is directly offline", () => {
    const self = { membershipId: "1", displayName: "Self", status: 9, observedInParty: true };
    const teammate = { membershipId: "2", displayName: "Teammate", status: 1, observedInParty: true };
    expect(offlineViewerParty([self, teammate], [self, teammate], "1")).toEqual([{ ...self, status: 0, observedInParty: false }]);
    expect(resolveViewerPartyObservation([self, teammate], [self, teammate], true, 0, "1", true)).toEqual({
      members: [{ ...self, status: 0, observedInParty: false }],
      consecutiveSoloObservations: 0
    });
  });

  it("applies the offline override during a tracked-progress share refresh", () => {
    const self = { membershipId: "1", displayName: "Self", status: 9, observedInParty: true };
    const teammate = { membershipId: "2", displayName: "Teammate", status: 1, observedInParty: true };
    expect(resolveViewerPartyObservation([self, teammate], [self, teammate], true, 2, "1", true)).toEqual({
      members: [{ ...self, status: 0, observedInParty: false }],
      consecutiveSoloObservations: 0
    });
  });

  it("does not present retained teammates as a current party when viewer presence is stale", () => {
    const members = [{ membershipId: "1", observedInParty: false }, { membershipId: "2", observedInParty: true }];
    expect(visiblePartyMembers(members, "1", true)).toEqual(members);
    expect(visiblePartyMembers(members, "1", false)).toEqual([{ membershipId: "1", observedInParty: false }]);
  });

  it("keeps an internally retained transient member out of the current-party response", () => {
    const members = [{ membershipId: "1", observedInParty: false }, { membershipId: "2", observedInParty: false }];
    expect(visiblePartyMembers(members, "1", true)).toEqual([{ membershipId: "1", observedInParty: false }]);
  });

  it("preserves member results while bounding public lookup concurrency", async () => {
    let active = 0;
    let maximum = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await Promise.resolve();
      active -= 1;
      return value * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maximum).toBe(2);
  });

});
