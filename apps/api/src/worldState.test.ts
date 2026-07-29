import type { CompactManifest, HappeningCard } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import {
  normalizeBungieNews,
  normalizeGlobalAlerts,
  normalizePublicMilestones,
  notificationsFromWorldCards
} from "./worldState";

const observedAt = "2026-07-29T12:00:00.000Z";

function manifest(): CompactManifest {
  return {
    version: "test",
    generatedAt: observedAt,
    items: [],
    itemDefinitions: {},
    objectiveDefinitions: {},
    activityDefinitions: {
      "101": {
        activityTypeHash: 575572995,
        displayProperties: {
          name: "The Insight Terminus: Nightfall",
          description: "Stop Kargen in this week's Nightfall."
        }
      },
      "102": {
        displayProperties: {
          name: "The Insight Terminus: Grandmaster",
          description: "Conquer the Grandmaster Nightfall."
        }
      },
      "201": {
        displayProperties: {
          name: "Trials of Osiris",
          description: "Win rounds in the Trials of Osiris."
        }
      }
    },
    milestoneDefinitions: {
      "1": { displayProperties: { name: "Nightfall" } },
      "2": { displayProperties: { name: "Trials of Osiris" } }
    },
    activityModifierDefinitions: {
      "301": { displayProperties: { name: "Arc Surge" } }
    },
    recordDefinitions: {}
  };
}

describe("public milestone normalization", () => {
  it("turns active milestone activities into categorized, timed dashboard cards", () => {
    const cards = normalizePublicMilestones({
      "1": {
        milestoneHash: 1,
        startDate: "2026-07-28T19:00:00.000Z",
        endDate: "2026-08-04T19:00:00.000Z",
        activities: [{ activityHash: 101, modifierHashes: [301] }, { activityHash: 102, modifierHashes: [301] }]
      },
      "2": {
        milestoneHash: 2,
        startDate: "2026-07-29T11:00:00.000Z",
        endDate: "2026-07-29T16:00:00.000Z",
        activities: [{ activityHash: 201 }]
      },
      expired: {
        milestoneHash: 3,
        endDate: "2026-07-29T11:59:59.000Z",
        activities: [{ activityHash: 101 }]
      }
    }, manifest(), observedAt);

    expect(cards.some((card) => card.category === "vanguard" && card.section === "weekly")).toBe(true);
    expect(cards.find((card) => card.category === "vanguard")?.description).toContain("Modifiers: Arc Surge.");
    expect(cards).toContainEqual(expect.objectContaining({
      category: "trials",
      state: "ending-soon",
      priority: "high",
      endsAt: "2026-07-29T16:00:00.000Z"
    }));
    expect(cards.every((card) => card.sourceConfidence === "live-api")).toBe(true);
  });
});

describe("official news and service alerts", () => {
  it("keeps current Bungie news and routes maintenance to upcoming alerts", () => {
    const cards = normalizeBungieNews({
      NewsArticles: [
        {
          Title: "Destiny 2 maintenance begins tomorrow",
          PubDate: "2026-07-29T10:00:00.000Z",
          Link: "/7/en/News/Article/test-maintenance",
          Description: "<p>Destiny will undergo scheduled maintenance.</p>"
        },
        {
          Title: "Old article",
          PubDate: "2026-01-01T10:00:00.000Z",
          Link: "/7/en/News/Article/old"
        }
      ]
    }, observedAt);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      section: "upcoming",
      category: "warning",
      priority: "high",
      sourceConfidence: "confirmed"
    });
    expect(cards[0]?.externalUrl).toBe("https://www.bungie.net/7/en/News/Article/test-maintenance");
  });

  it("marks an outage alert as critical without mixing it into another provider", () => {
    const cards = normalizeGlobalAlerts([{
      AlertKey: "api-outage",
      AlertLevel: 3,
      AlertHtml: "Destiny services are temporarily unavailable.",
      AlertTimestamp: "2026-07-29T11:55:00.000Z"
    }], observedAt);

    expect(cards).toEqual([expect.objectContaining({
      section: "live",
      category: "outage",
      priority: "critical",
      title: "Destiny service alert"
    })]);
  });
});

describe("world notification projection", () => {
  it("uses the same actionable card records for feed notifications", () => {
    const cards: HappeningCard[] = [{
      id: "milestone:trials:2:201",
      section: "live",
      category: "trials",
      priority: "high",
      state: "live",
      title: "Trials of Osiris",
      status: "Available now",
      destinationUrl: "/whats-happening",
      startsAt: "2026-07-29T11:00:00.000Z",
      endsAt: "2026-07-29T16:00:00.000Z",
      sourceLabel: "Bungie public milestones",
      sourceConfidence: "live-api",
      observedAt
    }];

    expect(notificationsFromWorldCards(cards, new Date(observedAt))).toEqual([expect.objectContaining({
      id: "world:milestone:trials:2:201:2026-07-29T11:00:00.000Z",
      eventKey: "world:milestone:trials:2:201",
      category: "trials",
      expiresAt: "2026-07-29T16:00:00.000Z"
    })]);
  });
});
