import type { CompactManifest, HappeningCard } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import {
  normalizeBungieNews,
  normalizeGlobalAlerts,
  normalizePublicMilestones,
  ironBannerCadenceCard,
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
      },
      "401": { activityTypeHash: 2043403989, displayProperties: { name: "King's Fall: Standard" } },
      "402": { activityTypeHash: 2043403989, displayProperties: { name: "Last Wish: Standard" } },
      "403": { activityTypeHash: 2043403989, displayProperties: { name: "Deep Stone Crypt" } }
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

  it("preserves individual raid challenge rotations for the dedicated page", () => {
    const shared = {
      startDate: "2026-07-28T19:00:00.000Z",
      endDate: "2026-08-04T19:00:00.000Z"
    };
    const cards = normalizePublicMilestones({
      a: { ...shared, milestoneHash: 10, activities: [{ activityHash: 401 }] },
      b: { ...shared, milestoneHash: 11, activities: [{ activityHash: 402 }] },
      c: { ...shared, milestoneHash: 12, activities: [{ activityHash: 403 }] }
    }, manifest(), observedAt);

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.title)).toEqual(expect.arrayContaining([
      "Raid · King's Fall: Standard",
      "Raid · Last Wish: Standard",
      "Raid · Deep Stone Crypt"
    ]));
    expect(cards.every((card) => card.destinationUrl === "/activities/raids")).toBe(true);
  });

  it("recognizes the stable public Iron Banner milestone even without a named activity", () => {
    const cards = normalizePublicMilestones({
      banner: {
        milestoneHash: 4248276869,
        startDate: "2026-07-28T19:00:00.000Z",
        endDate: "2026-08-04T19:00:00.000Z"
      }
    }, manifest(), observedAt);

    expect(cards).toEqual([expect.objectContaining({
      category: "iron-banner",
      section: "live",
      title: "Iron Banner",
      destinationUrl: "/pvp"
    })]);
  });

  it("recognizes Iron Banner from Bungie's activity-mode enum when the milestone identity changes", () => {
    const cards = normalizePublicMilestones({
      banner: {
        milestoneHash: 999,
        startDate: "2026-07-28T19:00:00.000Z",
        endDate: "2026-08-04T19:00:00.000Z",
        activities: [{ activityModes: [43] }]
      }
    }, manifest(), observedAt);

    expect(cards).toEqual([expect.objectContaining({ category: "iron-banner", destinationUrl: "/pvp" })]);
  });
});

describe("Iron Banner cadence fallback", () => {
  it("keeps the active event visible when public milestones omit it", () => {
    expect(ironBannerCadenceCard(new Date("2026-07-29T12:00:00.000Z"))).toMatchObject({
      section: "live",
      category: "iron-banner",
      state: "live",
      title: "Iron Banner is live",
      status: "2026-08-04T19:00:00.000Z",
      sourceConfidence: "predicted"
    });
  });

  it("shows the next occurrence as upcoming between events", () => {
    expect(ironBannerCadenceCard(new Date("2026-08-05T12:00:00.000Z"))).toMatchObject({
      section: "upcoming",
      state: "upcoming",
      title: "Next Iron Banner",
      status: "2026-08-25T19:00:00.000Z"
    });
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
      destinationUrl: "/director",
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
