import { describe, expect, it } from "vitest";
import { characterSessionClockActive, normalizeGuardian } from "./normalize";

const manifest = { version: "test", generatedAt: "now", names: { "123": "The Tower" } };

function profile(dateLastPlayed: string, minutesPlayedThisSession: number, responseMintedTimestamp: string) {
  return {
    responseMintedTimestamp,
    profile: { data: {} },
    characters: { data: { c1: { characterId: "c1", classType: 2, raceType: 2, light: 550, dateLastPlayed, minutesPlayedThisSession } } },
    characterActivities: { data: { c1: { currentActivityHash: 123 } } },
    characterInventories: { data: { c1: { items: [] } } }
  };
}

describe("Guardian header presence", () => {
  it("does not call a retained session total and activity in game", () => {
    const stale = profile("2026-09-07T06:47:39Z", 237, "2026-09-09T14:59:48.317Z");
    const guardian = normalizeGuardian({
      profile: stale,
      membershipId: "member",
      membershipType: 3,
      displayName: "Guardian",
      bungieName: "Guardian#1234",
      rewardsPass: { rank: 0, progress: { state: "unavailable", source: "bungie-profile-character-progressions" } },
      manifest
    });

    expect(characterSessionClockActive(guardian.characters[0], stale.responseMintedTimestamp)).toBe(false);
    expect(guardian.isInGame).toBe(false);
    expect(guardian.currentActivity).toBeUndefined();
  });

  it("recognizes a session clock that follows the current source snapshot", () => {
    const live = profile("2026-09-09T14:00:00Z", 59, "2026-09-09T14:59:30Z");
    const guardian = normalizeGuardian({
      profile: live,
      membershipId: "member",
      membershipType: 3,
      displayName: "Guardian",
      bungieName: "Guardian#1234",
      rewardsPass: { rank: 0, progress: { state: "unavailable", source: "bungie-profile-character-progressions" } },
      manifest
    });

    expect(guardian.isInGame).toBe(true);
    expect(guardian.currentActivity).toBe("The Tower");
  });
});
