import { describe, expect, it } from "vitest";
import { fireteamSocialCacheState, guardianSessionCacheState, mapWithConcurrency, preservePartyWhenTransitoryIsMissing } from "./fireteamReliability";

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

  it("does not collapse a saved Fireteam when a route omitted transitory data", () => {
    const self = { membershipId: "1", displayName: "Self", status: 1, observedInParty: false };
    const teammate = { membershipId: "2", displayName: "Teammate", status: 1, observedInParty: true };
    expect(preservePartyWhenTransitoryIsMissing([self], [self, teammate], false)).toEqual([self, teammate]);
    expect(preservePartyWhenTransitoryIsMissing([self], [self, teammate], true)).toEqual([self]);
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
