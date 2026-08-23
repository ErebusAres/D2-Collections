import { describe, expect, it } from "vitest";
import { equippedCharacterPower, guardianSessionCacheState, observeGuardianSession } from "./fireteamReliability";

describe("Fireteam reliability helpers", () => {
  it("uses the active character's eight equipped item powers instead of an inflated character light value", () => {
    const powers = [493, 493, 493, 493, 493, 493, 493, 493];
    const profile = {
      characterEquipment: { data: { active: { items: powers.map((_, index) => ({ itemInstanceId: `item-${index}` })) } } },
      itemComponents: { instances: { data: Object.fromEntries(powers.map((power, index) => [`item-${index}`, { primaryStat: { value: power } }])) } }
    };
    expect(equippedCharacterPower(profile, "active", 545)).toBe(493);
  });

  it("falls back to Bungie's character value when all eight equipped power slots are not available", () => {
    const profile = {
      characterEquipment: { data: { active: { items: [{ itemInstanceId: "weapon" }] } } },
      itemComponents: { instances: { data: { weapon: { primaryStat: { value: 472 } } } } }
    };
    expect(equippedCharacterPower(profile, "active", 545)).toBe(545);
  });

  it("classifies account snapshot freshness", () => {
    const now = Date.parse("2026-08-09T06:00:00.000Z");
    expect(guardianSessionCacheState(undefined, now)).toBe("missing");
    expect(guardianSessionCacheState("2026-08-09T05:59:00.000Z", now)).toBe("fresh");
    expect(guardianSessionCacheState("2026-08-09T05:00:00.000Z", now)).toBe("stale");
    expect(guardianSessionCacheState("2026-08-08T05:00:00.000Z", now)).toBe("expired");
  });

  it("does not treat a stale non-zero session total as online presence", () => {
    const first = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 47 }],
      undefined,
      "2026-08-10T12:00:00.000Z"
    );
    expect(first.onlineState).toBe("unknown");
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
    const grace = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 48 }],
      advanced.evidence,
      "2026-08-10T12:03:00.000Z"
    );
    expect(grace.onlineState).toBe("online");
    const expired = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 48 }],
      grace.evidence,
      "2026-08-10T12:03:01.000Z"
    );
    expect(expired.onlineState).toBe("unknown");
  });

  it("marks an ordered all-zero session snapshot offline", () => {
    const observation = observeGuardianSession(
      [{ characterId: "c1", minutesPlayedThisSession: 0 }],
      undefined,
      "2026-08-10T12:00:00.000Z"
    );
    expect(observation.onlineState).toBe("offline");
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
  });
});
