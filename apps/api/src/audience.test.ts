import type { GuardianSummary } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { canViewAudienceMetrics, rankUpNotifications } from "./audience";

const guardian = {
  membershipId: "membership",
  membershipType: 3,
  displayName: "Guardian",
  bungieName: "Guardian#0000",
  selectedCharacterId: "character",
  characters: [],
  stats: {
    power: 550,
    guardianRank: 8,
    rewardsPassRank: 104,
    rewardsPassProgress: { state: "unavailable", source: "bungie-profile-character-progressions" },
    mailboxCount: 0
  },
  isInGame: false
} satisfies GuardianSummary;

describe("rank-up account notifications", () => {
  it("does not celebrate the initial profile baseline", () => {
    expect(rankUpNotifications(undefined, guardian)).toEqual([]);
    expect(rankUpNotifications({ last_guardian_rank: null, last_rewards_pass_rank: null }, guardian)).toEqual([]);
  });

  it("creates private fanfare notifications for increased Guardian and Rewards Pass ranks", () => {
    const notifications = rankUpNotifications(
      { last_guardian_rank: 7, last_rewards_pass_rank: 102 },
      guardian,
      new Date("2026-07-30T03:00:00.000Z")
    );

    expect(notifications).toEqual([
      expect.objectContaining({
        id: "account:membership:guardian-rank:8",
        type: "guardian-rank-up",
        scope: "account",
        title: "Guardian Rank 8 reached",
        destinationUrl: "/journey/guardian-rank",
        metadata: expect.objectContaining({ fanfare: "rank-up", previousRank: 7, currentRank: 8 })
      }),
      expect.objectContaining({
        id: "account:membership:rewards-pass:104",
        type: "rewards-pass-up",
        title: "Rewards Pass rank 104 reached",
        destinationUrl: "/rewards"
      })
    ]);
  });

  it("does not celebrate unchanged ranks or seasonal resets", () => {
    expect(rankUpNotifications(
      { last_guardian_rank: 8, last_rewards_pass_rank: 105 },
      guardian
    )).toEqual([]);
  });
});

describe("Audience administrator access", () => {
  it("requires an explicitly allowlisted membership", () => {
    expect(canViewAudienceMetrics("admin", "admin,other")).toBe(true);
    expect(canViewAudienceMetrics("guardian", "admin,other")).toBe(false);
  });
});
