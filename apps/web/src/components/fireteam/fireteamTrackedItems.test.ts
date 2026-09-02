import type { FireteamMember, FireteamTrackedItem } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import {
  fireteamMemberPresenceLocation,
  fireteamTrackedItemKey,
  legacyQuestToFireteamTrackedItem,
  orderedFireteamTrackedItemKeys,
  orderFireteamTrackedItems
} from "./fireteamTrackedItems";

function trackedItem(id: string, kind: FireteamTrackedItem["kind"] = "quest"): FireteamTrackedItem {
  return {
    id,
    definitionHash: `definition-${id}`,
    kind,
    name: `Tracked item ${id}`,
    description: "Description",
    icon: "",
    context: "Quest",
    trackedInDestiny: true,
    trackedInGuardianNexus: false,
    objectives: [],
    percent: 0,
    updatedAt: "2026-09-02T00:00:00.000Z"
  };
}

describe("Fireteam tracked-item helpers", () => {
  it("builds a stable key from the tracked item kind and identifier", () => {
    expect(fireteamTrackedItemKey(trackedItem("123", "bounty"))).toBe("bounty:123");
  });

  it("places newly discovered items before the saved order", () => {
    const trackedItems = [trackedItem("new"), trackedItem("first"), trackedItem("second")];
    const preferredOrder = ["quest:first", "quest:second"];

    expect(orderedFireteamTrackedItemKeys(trackedItems, preferredOrder)).toEqual([
      "quest:new",
      "quest:first",
      "quest:second"
    ]);
    expect(orderFireteamTrackedItems(trackedItems, preferredOrder).map((item) => item.id)).toEqual([
      "new",
      "first",
      "second"
    ]);
  });

  it("converts the legacy quest representation without changing its meaning", () => {
    const legacyQuest = {
      instanceId: "quest-instance",
      itemHash: "quest-definition",
      category: "order",
      name: "Seasonal order",
      description: "Order description",
      currentStep: "Complete the current objective",
      icon: "/order.png",
      activityName: "Seasonal Hub",
      inGameTracked: true,
      sitePinned: true,
      objectives: [{
        objectiveHash: "objective",
        name: "Progress",
        progress: 2,
        completionValue: 5,
        percent: 40,
        complete: false
      }],
      percent: 40,
      updatedAt: "2026-09-02T00:00:00.000Z"
    } as FireteamMember["quests"][number];

    expect(legacyQuestToFireteamTrackedItem(legacyQuest)).toMatchObject({
      id: "quest-instance",
      definitionHash: "quest-definition",
      kind: "order",
      description: "Complete the current objective",
      context: "Order · Seasonal Hub",
      trackedInDestiny: true,
      trackedInGuardianNexus: true,
      percent: 40,
      objectives: [{ progressAvailable: true }]
    });
  });

  it("uses explicit offline and fallback presence labels", () => {
    expect(fireteamMemberPresenceLocation({ onlineState: "offline" })).toBe("Offline");
    expect(fireteamMemberPresenceLocation({ onlineState: "online", activity: "Orbit" })).toBe("Orbit");
    expect(fireteamMemberPresenceLocation({ onlineState: "unknown" }, "Last known activity")).toBe("Last known activity");
    expect(fireteamMemberPresenceLocation({ onlineState: "online" })).toBe("Online · location unavailable");
  });
});
