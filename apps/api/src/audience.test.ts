import type { GuardianSummary } from "@guardian-nexus/contracts";
import { describe, expect, it, vi } from "vitest";
import { audienceLocalization, canViewAudienceMetrics, rankUpNotifications, recordAudienceSessionSeen } from "./audience";
import type { Env } from "./types";

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

describe("coarse audience localization", () => {
  it("records browser checks with a five-minute write guard without changing sign-in time", async () => {
    const run = vi.fn().mockResolvedValue({});
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    await recordAudienceSessionSeen({ DB: { prepare } } as unknown as Env, "guardian", new Date("2026-09-14T12:00:00Z"));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining("last_seen_at IS NULL OR last_seen_at < ?"));
    expect(prepare.mock.calls[0]?.[0]).not.toContain("updated_at");
    expect(bind).toHaveBeenCalledWith("2026-09-14T12:00:00.000Z", "guardian", "2026-09-14T11:55:00.000Z");
  });
  it("retains only coarse edge geography and the highest preference language", () => {
    const request = new Request("https://example.com", { headers: { "Accept-Language": "en;q=0.5,fr-CA;q=0.9,de;q=0" } });
    Object.defineProperty(request, "cf", { value: { country: "CA", region: "Quebec", city: "Montreal", latitude: "45.5", longitude: "-73.5" } });
    expect(audienceLocalization(request)).toEqual({ country: "CA", region: "Quebec", preferredLanguage: "fr-ca" });
  });
  it("does not trust spoofed geography headers or invent a VPN score", () => {
    const request = new Request("https://example.com", { headers: { "CF-IPCountry": "US", "X-Country": "US", "Accept-Language": "*, en;q=0, garbage;q=5" } });
    expect(audienceLocalization(request)).toEqual({ country: null, region: null, preferredLanguage: null });
  });
});

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
