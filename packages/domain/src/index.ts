import type {
  CompactManifest,
  ExoticCollectionEntry,
  GuardianClass,
  GuideEntry,
  QuestProgress,
  QuestRecommendation
} from "@guardian-nexus/contracts";

export const BUNGIE_IMAGE_ROOT = "https://www.bungie.net";

export function imageUrl(path?: string): string {
  if (!path) return "";
  return path.startsWith("/") ? `${BUNGIE_IMAGE_ROOT}${path}` : path;
}

export function className(classType: unknown): GuardianClass {
  if (Number(classType) === 0) return "Titan";
  if (Number(classType) === 1) return "Hunter";
  if (Number(classType) === 2) return "Warlock";
  return "Unknown";
}

export function partyPresenceLabel(status: number): string {
  if ((status & 8) !== 0) return "Fireteam leader";
  if ((status & 1) !== 0) return "Fireteam member";
  if ((status & 2) !== 0) return "Party member";
  if ((status & 4) !== 0) return "Group member";
  return "Public fireteam presence";
}

export function xurSchedule(now = new Date()): { active: boolean; arrival: string; departure: string; target: string } {
  const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17));
  friday.setUTCDate(friday.getUTCDate() - ((friday.getUTCDay() - 5 + 7) % 7));
  if (friday.getTime() > now.getTime()) friday.setUTCDate(friday.getUTCDate() - 7);
  const departure = new Date(friday.getTime() + 4 * 24 * 60 * 60_000);
  const active = now.getTime() >= friday.getTime() && now.getTime() < departure.getTime();
  const nextArrival = active ? friday : new Date(friday.getTime() + 7 * 24 * 60 * 60_000);
  return {
    active,
    arrival: nextArrival.toISOString(),
    departure: (active ? departure : new Date(nextArrival.getTime() + 4 * 24 * 60 * 60_000)).toISOString(),
    target: (active ? departure : nextArrival).toISOString()
  };
}

export function questStepPosition(definition: unknown, itemHash: string): { stepNumber?: number; stepCount?: number } {
  const itemList = (definition as any)?.setData?.itemList;
  if (!Array.isArray(itemList) || itemList.length === 0) return {};
  const ordered = itemList
    .map((entry: any, index: number) => ({ itemHash: String(entry?.itemHash || ""), trackingValue: Number(entry?.trackingValue || 0), index }))
    .filter((entry: { itemHash: string }) => entry.itemHash)
    .sort((a: { trackingValue: number; index: number }, b: { trackingValue: number; index: number }) => a.trackingValue - b.trackingValue || a.index - b.index);
  const stepIndex = ordered.findIndex((entry: { itemHash: string }) => entry.itemHash === itemHash);
  return stepIndex >= 0 ? { stepNumber: stepIndex + 1, stepCount: ordered.length } : {};
}

export function objectivePercent(progress: number, completionValue: number, complete = false): number {
  if (complete) return 100;
  if (!Number.isFinite(completionValue) || completionValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Math.max(0, progress) / completionValue) * 100)));
}

export function questPercent(quest: Pick<QuestProgress, "objectives">): number {
  if (!quest.objectives.length) return 0;
  return Math.round(quest.objectives.reduce((sum, objective) => sum + objective.percent, 0) / quest.objectives.length);
}

export function recommendQuests(
  quests: QuestProgress[],
  options: { pinnedIds?: ReadonlySet<string>; currentActivity?: string; now?: Date } = {}
): QuestRecommendation[] {
  const now = options.now ?? new Date();
  const pinnedIds = options.pinnedIds ?? new Set<string>();
  const activityCounts = quests.reduce<Record<string, number>>((counts, quest) => {
    const key = quest.activityName?.trim().toLowerCase();
    if (key) counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return quests.map((quest) => {
    let score = 0;
    const reasons: string[] = [];
    const key = quest.instanceId || quest.itemHash;
    const sitePinned = pinnedIds.has(key) || quest.sitePinned;
    if (sitePinned) {
      score += 1_000;
      reasons.push("Site pinned");
    }
    if (quest.inGameTracked) {
      score += 700;
      reasons.push("Tracked in Destiny");
    }
    const activity = quest.activityName?.trim().toLowerCase();
    const current = options.currentActivity?.trim().toLowerCase();
    if (activity && current && (activity.includes(current) || current.includes(activity))) {
      score += 450;
      reasons.push("Matches current activity");
    }
    if (activity && (activityCounts[activity] ?? 0) > 1) {
      score += Math.min(300, (activityCounts[activity] ?? 0) * 75);
      reasons.push("Progresses with other quests");
    }
    if (quest.expiresAt) {
      const hours = (new Date(quest.expiresAt).getTime() - now.getTime()) / 3_600_000;
      if (hours > 0 && hours <= 168) {
        score += Math.max(150, 400 - Math.round(hours));
        reasons.push("Expires soon");
      }
    }
    if (quest.percent >= 75 && quest.percent < 100) {
      score += 250 + quest.percent;
      reasons.push("Near completion");
    }
    if (quest.isExoticUnlock) {
      score += 175;
      reasons.push("Exotic unlock");
    }
    score += Math.min(100, quest.percent);
    if (!reasons.length) reasons.push("Active quest");
    return { quest: { ...quest, sitePinned }, score, reasons };
  }).sort((a, b) => b.score - a.score || b.quest.percent - a.quest.percent || a.quest.name.localeCompare(b.quest.name));
}

function fallbackGuide(item: CompactManifest["items"][number]): GuideEntry {
  const source = item.source || "Bungie does not currently publish a clear acquisition source.";
  return {
    itemHash: item.itemHash,
    acquisition: source,
    steps: source ? ["Use the current source shown here as the acquisition lead."] : [],
    prerequisites: [],
    catalystSource: item.catalystRecordHashes.length ? "Catalyst record detected in the current Bungie manifest." : undefined,
    catalystCompletion: item.catalystRecordHashes.length ? "Open the catalyst record in Destiny to confirm its current objective." : undefined,
    confidence: item.source ? "partial" : "pending",
    sources: [{ label: "Bungie manifest" }]
  };
}

export function mergeCollection(
  manifest: CompactManifest,
  state: {
    ownedCollectibleHashes: ReadonlySet<string>;
    completedRecordHashes: ReadonlySet<string>;
    visibleRecordHashes: ReadonlySet<string>;
    xurSaleItemHashes?: ReadonlySet<string>;
  },
  selectedClass: GuardianClass,
  guides: Record<string, GuideEntry> = {}
): ExoticCollectionEntry[] {
  const grouped = new Map<string, CompactManifest["items"]>();
  for (const item of manifest.items.filter((entry) => entry.kind === "weapon" || entry.className === selectedClass)) {
    const key = [item.kind, item.className ?? "", item.slot, item.name.trim().toLocaleLowerCase()].join("|");
    const variants = grouped.get(key) ?? [];
    variants.push(item);
    grouped.set(key, variants);
  }

  return [...grouped.values()]
    .map((variants) => {
      const item = [...variants].sort((a, b) => representativeScore(b) - representativeScore(a) || a.itemHash.localeCompare(b.itemHash))[0]!;
      const catalystRecordHashes = item.kind === "weapon"
        ? [...new Set(variants.flatMap((variant) => variant.catalystRecordHashes))]
        : [];
      const catalystAvailable = catalystRecordHashes.length > 0;
      const catalystComplete = catalystRecordHashes.some((hash) => state.completedRecordHashes.has(hash));
      const catalystOwned = catalystRecordHashes.some((hash) => state.visibleRecordHashes.has(hash));
      const owned = variants.some((variant) => variant.collectibleHash && state.ownedCollectibleHashes.has(variant.collectibleHash));
      const xurSelling = variants.some((variant) => state.xurSaleItemHashes?.has(variant.itemHash));
      const guide = variants.map((variant) => guides[variant.itemHash]).find(Boolean) ?? fallbackGuide({ ...item, catalystRecordHashes });
      return {
        ...item,
        icon: imageUrl(item.icon),
        watermark: imageUrl(item.watermark),
        owned,
        catalyst: !catalystAvailable ? "unavailable" : catalystComplete ? "complete" : catalystOwned ? "obtained" : "missing",
        xurSelling,
        guide
      } satisfies ExoticCollectionEntry;
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
}

function representativeScore(item: CompactManifest["items"][number]): number {
  return (item.collectibleHash ? 8 : 0)
    + (item.source ? 4 : 0)
    + (item.description ? 2 : 0)
    + (item.icon ? 1 : 0);
}
