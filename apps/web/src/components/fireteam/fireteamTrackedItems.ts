import type {
  FireteamCompletedTrackedItem,
  FireteamMember,
  FireteamTrackedItem
} from "@guardian-nexus/contracts";

export function fireteamTrackedItemKey(
  trackedItem: Pick<FireteamTrackedItem, "kind" | "id">
): string {
  return `${trackedItem.kind}:${trackedItem.id}`;
}

export function orderedFireteamTrackedItemKeys(
  trackedItems: FireteamTrackedItem[],
  preferredOrder: string[] = []
): string[] {
  const unorderedKeys = new Set(trackedItems.map(fireteamTrackedItemKey));
  const orderedKeys = preferredOrder.filter((trackedItemKey) => unorderedKeys.delete(trackedItemKey));
  return [...unorderedKeys, ...orderedKeys];
}

export function orderFireteamTrackedItems(
  trackedItems: FireteamTrackedItem[],
  preferredOrder: string[] = []
): FireteamTrackedItem[] {
  const trackedItemsByKey = new Map(
    trackedItems.map((trackedItem) => [fireteamTrackedItemKey(trackedItem), trackedItem])
  );

  return orderedFireteamTrackedItemKeys(trackedItems, preferredOrder)
    .map((trackedItemKey) => trackedItemsByKey.get(trackedItemKey)!)
    .filter(Boolean);
}

export function fireteamCompletionEventKey(
  completedTrackedItem: FireteamCompletedTrackedItem
): string {
  return `${fireteamTrackedItemKey(completedTrackedItem)}:${completedTrackedItem.completedAt}`;
}

export function legacyQuestToFireteamTrackedItem(
  quest: FireteamMember["quests"][number]
): FireteamTrackedItem {
  const trackedItemKind = quest.category || "quest";
  const trackedItemLabel = trackedItemKind === "bounty"
    ? "Bounty"
    : trackedItemKind === "order"
      ? "Order"
      : "Quest";

  return {
    id: quest.instanceId,
    definitionHash: quest.itemHash,
    kind: trackedItemKind,
    name: quest.name,
    description: quest.currentStep || quest.description,
    icon: quest.icon,
    context: quest.activityName
      ? `${trackedItemLabel} · ${quest.activityName}`
      : trackedItemLabel,
    trackedInDestiny: quest.inGameTracked,
    trackedInGuardianNexus: quest.sitePinned,
    objectives: quest.objectives.map((objective) => ({
      ...objective,
      progressAvailable: true
    })),
    percent: quest.percent,
    updatedAt: quest.updatedAt
  };
}

export function fireteamMemberPresenceLocation(
  member: Pick<FireteamMember, "onlineState" | "activity"> | undefined,
  fallbackLocation?: string
): string {
  if (member?.onlineState === "offline") return "Offline";
  if (member?.activity) return member.activity;
  if (fallbackLocation) return fallbackLocation;
  return member?.onlineState === "online"
    ? "Online · location unavailable"
    : "Presence unavailable";
}
