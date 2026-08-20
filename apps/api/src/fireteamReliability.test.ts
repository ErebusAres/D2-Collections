import { describe, expect, it } from "vitest";
import { fireteamPresenceRefreshDue, fireteamPresenceUsable, fireteamSocialCacheState, guardianSessionCacheState, mapWithConcurrency, observeGuardianSession, offlineViewerParty, partyObservationForProgressRefresh, resolvePartyObservation, resolveViewerPartyObservation, sessionPresenceConfirmed, sourceObservationTimestamp, syncedTeammatePresenceConfirmed, visiblePartyMembers } from "./fireteamReliability";

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
    expect(resolvePartyObservation([self], [self, teammate], false, 1)).toEqual({ members: [self, teammate], consecutiveSoloObservations: 1, candidateObservations: 0 });
    expect(resolvePartyObservation([self], [self, teammate], true, 0)).toEqual({ members: [self, teammate], consecutiveSoloObservations: 1, candidateSignature: "1", candidateObservations: 1 });
    expect(resolvePartyObservation([self], [self, teammate], true, 1, "1", 1)).toEqual({ members: [self, teammate], consecutiveSoloObservations: 2, candidateSignature: "1", candidateObservations: 2 });
    expect(resolvePartyObservation([self], [self, teammate], true, 2, "1", 2)).toEqual({ members: [self], consecutiveSoloObservations: 0, candidateObservations: 0 });
    expect(resolvePartyObservation([self, teammate], [self], true, 0)).toEqual({ members: [self], consecutiveSoloObservations: 0, candidateSignature: "1,2", candidateObservations: 1 });
    expect(resolvePartyObservation([self, teammate], [self], true, 0, "1,2", 1)).toEqual({ members: [self, teammate], consecutiveSoloObservations: 0, candidateObservations: 0 });
  });

  it("keeps progress refreshes from replacing an established presence snapshot", () => {
    const self = { membershipId: "1", displayName: "Self", status: 1, observedInParty: false };
    const staleTeammate = { membershipId: "2", displayName: "Stale", status: 1, observedInParty: true };
    const currentTeammate = { membershipId: "3", displayName: "Current", status: 1, observedInParty: true };
    expect(partyObservationForProgressRefresh([self, currentTeammate], 1, { members: [self, staleTeammate], consecutiveSoloObservations: 0, candidateObservations: 0 })).toEqual({
      members: [self, currentTeammate], consecutiveSoloObservations: 1, candidateObservations: 0
    });
    expect(partyObservationForProgressRefresh(undefined, 0, { members: [self, currentTeammate], consecutiveSoloObservations: 0, candidateObservations: 0 })).toEqual({
      members: [self, currentTeammate], consecutiveSoloObservations: 0, candidateObservations: 0
    });
  });

  it("refreshes Fireteam presence on the live-page cadence", () => {
    const now = Date.parse("2026-08-09T12:00:00.000Z");
    expect(fireteamPresenceRefreshDue(undefined, now)).toBe(true);
    expect(fireteamPresenceRefreshDue("2026-08-09T11:59:01.000Z", now)).toBe(false);
    expect(fireteamPresenceRefreshDue("2026-08-09T11:59:00.000Z", now)).toBe(true);
  });

  it("keeps the accepted roster stable through a short refresh outage", () => {
    const now = Date.parse("2026-08-09T12:00:00.000Z");
    expect(fireteamPresenceUsable("2026-08-09T11:50:00.000Z", now)).toBe(true);
    expect(fireteamPresenceUsable("2026-08-09T11:49:59.000Z", now)).toBe(false);
  });

  it("does not treat a stale non-zero session total as online presence", () => {
    const first = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 47 }],
      undefined,
      "2026-08-10T12:00:00.000Z"
    );
    expect(first.onlineState).toBe("unknown");
    expect(sessionPresenceConfirmed(first.evidence, "2026-08-10T12:00:00.000Z", Date.parse("2026-08-10T12:00:30.000Z"))).toBe(false);

    const frozen = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 47 }],
      first.evidence,
      "2026-08-10T12:01:00.000Z"
    );
    expect(frozen.onlineState).toBe("unknown");
  });

  it("keeps a moving session stable through repeated Bungie snapshots, then fails closed", () => {
    const baseline = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 47 }],
      undefined,
      "2026-08-10T12:00:00.000Z"
    );
    const advanced = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 48 }],
      baseline.evidence,
      "2026-08-10T12:01:00.000Z"
    );
    expect(advanced.onlineState).toBe("online");
    expect(advanced.activeCharacterId).toBe("c1");
    expect(sessionPresenceConfirmed(advanced.evidence, "2026-08-10T12:01:00.000Z", Date.parse("2026-08-10T12:02:00.000Z"))).toBe(true);

    const grace = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 48 }],
      advanced.evidence,
      "2026-08-10T12:03:00.000Z"
    );
    expect(grace.onlineState).toBe("online");
    expect(sessionPresenceConfirmed(grace.evidence, "2026-08-10T12:03:00.000Z", Date.parse("2026-08-10T12:03:00.000Z"))).toBe(true);
    const expired = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 48 }],
      grace.evidence,
      "2026-08-10T12:03:01.000Z"
    );
    expect(expired.onlineState).toBe("unknown");
    expect(sessionPresenceConfirmed(expired.evidence, "2026-08-10T12:03:01.000Z", Date.parse("2026-08-10T12:03:01.000Z"))).toBe(false);
  });

  it("accepts a recent successful fetch when Bungie's source snapshot was minted slightly earlier", () => {
    const evidence = {
      sourceObservedAt: "2026-08-10T12:01:00.000Z",
      lastAdvancedAt: "2026-08-10T12:01:00.000Z",
      minutesByCharacter: { c1: 48 }
    };
    expect(sessionPresenceConfirmed(evidence, "2026-08-10T12:01:30.000Z", Date.parse("2026-08-10T12:02:00.000Z"))).toBe(true);
  });

  it("marks an ordered all-zero session snapshot offline", () => {
    const observation = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 0 }],
      undefined,
      "2026-08-10T12:00:00.000Z"
    );
    expect(observation.onlineState).toBe("offline");
  });

  it("uses Bungie's source time and rejects an implausible future timestamp", () => {
    const now = Date.parse("2026-08-10T12:00:00.000Z");
    expect(sourceObservationTimestamp("2026-08-10T11:59:30.000Z", now)).toBe("2026-08-10T11:59:30.000Z");
    expect(sourceObservationTimestamp("2026-08-10T12:02:00.000Z", now)).toBe("2026-08-10T12:00:00.000Z");
  });

  it("collapses a stale Bungie party immediately when the viewer is directly offline", () => {
    const self = { membershipId: "1", displayName: "Self", status: 9, observedInParty: true };
    const teammate = { membershipId: "2", displayName: "Teammate", status: 1, observedInParty: true };
    expect(offlineViewerParty([self, teammate], [self, teammate], "1")).toEqual([{ ...self, status: 0, observedInParty: false }]);
    expect(resolveViewerPartyObservation([self, teammate], [self, teammate], true, 0, "1", true)).toEqual({
      members: [{ ...self, status: 0, observedInParty: false }],
      consecutiveSoloObservations: 0,
      candidateObservations: 0
    });
  });

  it("applies the offline override during a tracked-progress share refresh", () => {
    const self = { membershipId: "1", displayName: "Self", status: 9, observedInParty: true };
    const teammate = { membershipId: "2", displayName: "Teammate", status: 1, observedInParty: true };
    expect(resolveViewerPartyObservation([self, teammate], [self, teammate], true, 2, "1", true)).toEqual({
      members: [{ ...self, status: 0, observedInParty: false }],
      consecutiveSoloObservations: 0,
      candidateObservations: 0
    });
  });

  it("does not resurrect a collapsed Fireteam from one stale party snapshot", () => {
    const self = { membershipId: "1", displayName: "Self", status: 1, observedInParty: false };
    const teammate = { membershipId: "2", displayName: "Teammate", status: 1, observedInParty: true };
    const first = resolvePartyObservation([self, teammate], [self], true, 0);
    expect(first.members).toEqual([self]);
    expect(first.candidateObservations).toBe(1);
    const soloAgain = resolvePartyObservation([self], first.members, true, first.consecutiveSoloObservations, first.candidateSignature, first.candidateObservations);
    expect(soloAgain).toEqual({ members: [self], consecutiveSoloObservations: 0, candidateObservations: 0 });
  });

  it("does not present retained teammates as a current party when viewer presence is stale", () => {
    const members = [{ membershipId: "1", observedInParty: false }, { membershipId: "2", observedInParty: true }];
    expect(visiblePartyMembers(members, "1", true)).toEqual(members);
    expect(visiblePartyMembers(members, "1", false)).toEqual([{ membershipId: "1", observedInParty: false }]);
  });

  it("confirms a current session from Bungie's character clock without waiting for a counter transition", () => {
    const observation = observeGuardianSession(
      [{ characterId: "c1", dateLastPlayed: "2026-08-15T12:00:00.000Z", minutesPlayedThisSession: 4 }],
      undefined,
      "2026-08-15T12:04:30.000Z"
    );
    expect(observation.onlineState).toBe("online");
    expect(observation.activeCharacterId).toBe("c1");
    expect(observation.evidence.lastAdvancedAt).toBe("2026-08-15T12:04:30.000Z");
  });

  it("does not let a retained non-authoritative party roster prove that a stopped session is live", () => {
    const observation = observeGuardianSession(
      [{ characterId: "c1", dateLastPlayed: "2026-08-15T12:00:00.000Z", minutesPlayedThisSession: 4 }],
      { sourceObservedAt: "2026-08-15T12:04:00.000Z", minutesByCharacter: { c1: 4 }, lastAdvancedAt: "2026-08-15T12:04:00.000Z" },
      "2026-08-15T12:08:00.000Z"
    );
    expect(observation.onlineState).toBe("unknown");
    expect(sessionPresenceConfirmed(observation.evidence, "2026-08-15T12:08:00.000Z", Date.parse("2026-08-15T12:15:01.000Z"))).toBe(false);
  });

  it("keeps an internally retained transient member out of the current-party response", () => {
    const members = [{ membershipId: "1", observedInParty: false }, { membershipId: "2", observedInParty: false }];
    expect(visiblePartyMembers(members, "1", true)).toEqual([{ membershipId: "1", observedInParty: false }]);
  });

  it("does not let a stale teammate share veto a member in the viewer's fresh Bungie party roster", () => {
    const members = [{ membershipId: "1", observedInParty: true }, { membershipId: "2", observedInParty: true }];
    expect(visiblePartyMembers(members, "1", true)).toEqual(members);
  });

  it("does not let reciprocal stale party snapshots corroborate each other", () => {
    const now = Date.parse("2026-08-10T12:02:00.000Z");
    const staleTeammate = {
      onlineState: "online",
      activityPartyMembers: [{ membershipId: "1", observedInParty: true }]
    };
    expect(sessionPresenceConfirmed(undefined, "2026-08-10T12:01:00.000Z", now)).toBe(false);
    expect(syncedTeammatePresenceConfirmed(staleTeammate, "1", "2026-08-10T12:01:00.000Z", now)).toBe(false);

    const independentlyLiveTeammate = {
      ...staleTeammate,
      sessionPresenceEvidence: {
        sourceObservedAt: "2026-08-10T12:01:00.000Z",
        lastAdvancedAt: "2026-08-10T12:01:00.000Z",
        minutesByCharacter: { c2: 18 }
      }
    };
    expect(syncedTeammatePresenceConfirmed(independentlyLiveTeammate, "1", "2026-08-10T12:01:00.000Z", now)).toBe(true);
    expect(syncedTeammatePresenceConfirmed({ ...independentlyLiveTeammate, activityPartyMembers: [] }, "1", "2026-08-10T12:01:00.000Z", now)).toBe(false);
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
