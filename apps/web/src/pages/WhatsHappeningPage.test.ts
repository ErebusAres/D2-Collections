import { describe, expect, it } from "vitest";
import type { QuestData } from "@guardian-nexus/contracts";
import { accountActivityCards, formatResetCountdown } from "./WhatsHappeningPage";

describe("reset countdown", () => {
  const now = Date.parse("2026-07-29T16:00:00.000Z");

  it("keeps longer reset windows concise", () => {
    expect(formatResetCountdown("2026-07-31T17:00:00.000Z", now)).toBe("2d 1h");
    expect(formatResetCountdown("2026-07-29T18:05:00.000Z", now)).toBe("2h 05m");
  });

  it("shows a live-ready seconds value during the final hour", () => {
    expect(formatResetCountdown("2026-07-29T16:05:06.000Z", now)).toBe("5m 06s");
    expect(formatResetCountdown("2026-07-29T16:05:06.000Z", now + 1_000)).toBe("5m 05s");
  });

  it("does not show a negative countdown after reset", () => {
    expect(formatResetCountdown("2026-07-29T15:59:00.000Z", now)).toBe("0m 00s");
  });
});

describe("Director account opportunities", () => {
  it("surfaces tracked and near-complete quests without repeating bounties", () => {
    const quests = {
      quests: [
        {
          instanceId: "quest-1",
          itemHash: "1",
          name: "Almost There",
          description: "",
          icon: "",
          currentStep: "Finish it",
          characterId: "character",
          inGameTracked: false,
          sitePinned: false,
          isExoticUnlock: false,
          rewards: [],
          objectives: [],
          percent: 82,
          updatedAt: "2026-07-29T12:00:00.000Z",
          category: "quest"
        },
        {
          instanceId: "bounty-1",
          itemHash: "2",
          name: "Daily Bounty",
          description: "",
          icon: "",
          currentStep: "",
          characterId: "character",
          inGameTracked: false,
          sitePinned: false,
          isExoticUnlock: false,
          rewards: [],
          objectives: [],
          percent: 90,
          updatedAt: "2026-07-29T12:00:00.000Z",
          category: "bounty"
        }
      ],
      recommendations: []
    } satisfies QuestData;

    expect(accountActivityCards(undefined, quests)).toContainEqual(expect.objectContaining({
      id: "account:quest-opportunities",
      section: "personal",
      status: "1 tracked or near completion",
      description: "Almost There (82%)"
    }));
  });
});
