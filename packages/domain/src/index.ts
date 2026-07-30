import type {
  ArmorGrade,
  ArmorItem,
  ArmorStatKey,
  CompactManifest,
  CollectionFeature,
  ExoticCollectionEntry,
  GuardianClass,
  GuideEntry,
  QuestProgress,
  QuestRecommendation
} from "@guardian-nexus/contracts";

export * from "./gearSearch";
export * from "./buildArmorSets";
export * from "./buildCatalog";

export const ARMOR_STAT_KEYS: ArmorStatKey[] = ["health", "melee", "grenade", "super", "class", "weapons"];

export function armorGrade(baseStats: Partial<Record<ArmorStatKey, number>>): ArmorGrade {
  const values = ARMOR_STAT_KEYS.map((key) => Number(baseStats[key] || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return { letter: "—" };
  const letter: ArmorGrade["letter"] = total >= 75 ? "S" : total >= 72 ? "A" : total >= 68 ? "B" : total >= 63 ? "C" : total >= 58 ? "D" : "F";
  return { letter, score: Math.round(Math.min(100, total * 1.15 + Math.max(...values) * 1.25)) };
}

export interface ArmorComparisonGroup { id: string; label: string; colorIndex: number; items: ArmorItem[] }
export type ArmorGroupMode = "similar" | "same-stats" | "same-name-similar" | "same-name-stats";

const ARMOR_SLOT_ORDER = ["Helmet", "Gauntlets", "Chest Armor", "Leg Armor", "Class Item"];

export function groupArmor(items: ArmorItem[], tolerance = 5, mode: ArmorGroupMode | boolean = "similar"): ArmorComparisonGroup[] {
  const groupMode: ArmorGroupMode = typeof mode === "boolean" ? (mode ? "same-stats" : "similar") : mode;
  const buckets = new Map<string, ArmorItem[]>();
  for (const item of items.filter((entry) => entry.baseTotal > 0)) {
    const identity = groupMode.startsWith("same-name") || item.rarity === "Exotic" ? item.name.toLowerCase() : "all-names";
    const key = [item.className, item.slot, item.rarity, identity].join("|");
    buckets.set(key, [...(buckets.get(key) || []), item]);
  }
  const found: ArmorItem[][] = [];
  for (const bucket of buckets.values()) {
    const pending = [...bucket].sort((a, b) => b.baseTotal - a.baseTotal || a.instanceId.localeCompare(b.instanceId));
    while (pending.length) {
      const seed = pending.shift()!; const matched = [seed];
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const candidate = pending[index];
        if (candidate && comparableArmor(seed, candidate, tolerance, groupMode)) {
          const removed = pending.splice(index, 1)[0];
          if (removed) matched.push(removed);
        }
      }
      if (matched.length > 1) found.push(matched);
    }
  }
  const ordered = found.sort((a, b) => slotNumber(a[0]!.slot) - slotNumber(b[0]!.slot) || a[0]!.className.localeCompare(b[0]!.className) || a[0]!.rarity.localeCompare(b[0]!.rarity) || b[0]!.baseTotal - a[0]!.baseTotal);
  const perSlot = new Map<number, number>();
  return ordered.map((itemsInGroup, index) => {
    const slot = slotNumber(itemsInGroup[0]!.slot);
    const sequence = (perSlot.get(slot) || 0) + 1;
    perSlot.set(slot, sequence);
    const label = `${slot}${letterFor(sequence)}`;
    return {
      id: label, label, colorIndex: index % 6,
      items: itemsInGroup.sort((a, b) => b.baseTotal - a.baseTotal || b.currentTotal - a.currentTotal || a.instanceId.localeCompare(b.instanceId))
    };
  });
}

function slotNumber(slot: string): number { const index = ARMOR_SLOT_ORDER.indexOf(slot); return index >= 0 ? index + 1 : 9; }
function letterFor(value: number): string { let current = Math.max(1, value); let result = ""; while (current > 0) { current -= 1; result = String.fromCharCode(65 + (current % 26)) + result; current = Math.floor(current / 26); } return result; }

function comparableArmor(a: ArmorItem, b: ArmorItem, tolerance: number, mode: ArmorGroupMode): boolean {
  if (mode === "same-stats" || mode === "same-name-stats") return ARMOR_STAT_KEYS.every((key) => a.baseStats[key] === b.baseStats[key]);
  const top = (item: ArmorItem) => ARMOR_STAT_KEYS.map((key) => [key, item.baseStats[key]] as const).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 3);
  const aTop = top(a); const bTop = top(b);
  return aTop.every(([key, value], index) => Boolean(bTop[index] && bTop[index]![0] === key && Math.abs(value - bTop[index]![1]) <= Math.max(0, tolerance)));
}

export const BUNGIE_IMAGE_ROOT = "https://www.bungie.net";

export type CollectionSortMode = "position" | "type" | "alpha" | "owned" | "missing" | "source";

export function sortCollectionEntries(entries: ExoticCollectionEntry[], mode: CollectionSortMode): ExoticCollectionEntry[] {
  return [...entries].sort((a, b) => {
    if (mode === "alpha") return a.name.localeCompare(b.name) || a.itemType.localeCompare(b.itemType);
    if (mode === "type") return a.kind.localeCompare(b.kind) || a.itemType.localeCompare(b.itemType) || a.name.localeCompare(b.name);
    if (mode === "owned") return Number(b.owned) - Number(a.owned) || a.name.localeCompare(b.name);
    if (mode === "missing") return Number(a.owned) - Number(b.owned) || a.name.localeCompare(b.name);
    if (mode === "source") return (a.source || "Unknown source").localeCompare(b.source || "Unknown source") || a.name.localeCompare(b.name);
    return collectionPosition(a) - collectionPosition(b) || a.name.localeCompare(b.name);
  });
}

function collectionPosition(entry: ExoticCollectionEntry): number {
  if (entry.kind === "weapon") return 10;
  const slot = entry.slot.toLocaleLowerCase();
  if (slot.includes("helmet") || slot.includes("head")) return 0;
  if (slot.includes("gauntlet") || slot.includes("arm")) return 1;
  if (slot.includes("chest")) return 2;
  if (slot.includes("leg")) return 3;
  if (slot.includes("class")) return 4;
  return 5;
}

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
  const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 19));
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
  const curated = curatedAcquisitionGuide(item);
  if (curated) return curated;
  const source = item.source.trim().replace(/^source:\s*/i, "").replace(/\.$/, "");
  const route = acquisitionRoute(item.name, item.kind, source);
  return {
    itemHash: item.itemHash,
    acquisition: route.acquisition,
    steps: route.steps,
    prerequisites: route.prerequisites,
    catalystSource: item.catalystRecordHashes.length ? "Catalyst record detected in the current Bungie manifest." : undefined,
    catalystCompletion: item.catalystRecordHashes.length ? "Open the catalyst record in Destiny to confirm its current objective." : undefined,
    confidence: source ? "partial" : "pending",
    sources: [{ label: "Bungie manifest" }]
  };
}

function acquisitionRoute(name: string, kind: "weapon" | "armor", source: string): Pick<GuideEntry, "acquisition" | "steps" | "prerequisites"> {
  if (/exotic armor focusing/i.test(source)) return {
    acquisition: "Exotic Armor Focusing at the Cryptarch in the Tower",
    steps: [`Visit the Cryptarch in the Tower and open Exotic Armor Focusing.`, `Select ${name} when it appears in the focusing list and meet the displayed Engram and currency cost.`],
    prerequisites: ["Use the class that can equip this armor."]
  };
  if (/exotic archive|monument to lost lights/i.test(source)) return {
    acquisition: "Monument to Lost Lights Exotic Archive in the Tower",
    steps: [`Visit the Monument to Lost Lights beside the Vault in the Tower.`, `Open the matching expansion section, select ${name}, and pay the materials shown on the item.`],
    prerequisites: ["Own the expansion or pack shown on the archive entry.", "Bring the displayed Exotic Cipher, Glimmer, and any additional required material."]
  };
  if (/\bengrams?\b|world drops/i.test(source)) return {
    acquisition: "Exotic Engrams and current Exotic focusing",
    steps: ["Earn Exotic Engrams from current activity rewards and weekly challenges.", `Decrypt the Engram at the Cryptarch, or focus ${name} there when it is eligible.`],
    prerequisites: kind === "armor" ? ["Use the class that can equip this armor."] : []
  };
  if (/season pass|rewards pass/i.test(source)) return {
    acquisition: source,
    steps: [`Claim ${name} from its Rewards Pass rank if that pass is active.`, "For a retired weapon reward, visit the Monument to Lost Lights in the Tower and open its matching year or expansion section."],
    prerequisites: []
  };
  if (/xûr|xur/i.test(source)) return {
    acquisition: "Xûr",
    steps: [`Visit Xûr while he is available and purchase ${name} if it is in his current inventory.`],
    prerequisites: ["Bring the Strange Coins or other currency displayed by Xûr."]
  };
  if (/raid/i.test(source)) return {
    acquisition: source,
    steps: [`Launch ${source.replace(/\braid\b\.?$/i, "").trim()} from the Director and complete the encounter that awards ${name}.`, "Complete any listed Triumphs that increase the Exotic drop chance before repeating the eligible encounter."],
    prerequisites: ["Own the expansion or content pack required by the raid."]
  };
  if (/dungeon|vesper's host|sundered doctrine/i.test(source)) return {
    acquisition: source,
    steps: [`Launch ${source.replace(/^dungeon\s*/i, "").replace(/^["']|["']$/g, "")} from the Director and complete its final encounter for a chance at ${name}.`, "Complete the dungeon Triumphs that list an increased Exotic drop chance before farming additional clears."],
    prerequisites: ["Own the Dungeon Key or content entitlement required by the activity."]
  };
  if (/quest|mission|campaign|empire hunt|exploring|equilibrium|fortress|renegades|episode:|season of|monument of triumph/i.test(source)) return {
    acquisition: source,
    steps: [`Locate ${source} in the Director, Portal, Timeline, or active quest log.`, `Complete its objectives and claim ${name} from the final quest step or reward chest.`],
    prerequisites: []
  };
  if (/pre-order|deluxe edition/i.test(source)) return {
    acquisition: source,
    steps: [`Visit the Special Deliveries kiosk in the Tower and claim ${name} from the matching entitlement.`],
    prerequisites: ["Own the edition or preorder entitlement that includes this item."]
  };
  if (/guardian games/i.test(source)) return {
    acquisition: "Guardian Games event reward",
    steps: [`During Guardian Games, speak with the event vendor in the Tower and complete the event requirement that awards ${name}.`],
    prerequisites: ["Guardian Games must be active."]
  };
  return kind === "armor" ? {
    acquisition: "Exotic Armor Focusing or Exotic Engrams",
    steps: [`Visit the Cryptarch in the Tower and look for ${name} in Exotic Armor Focusing.`, "If it is not focusable yet, earn and decrypt Exotic Engrams until its unlock requirement is met."],
    prerequisites: ["Use the class that can equip this armor."]
  } : {
    acquisition: source || "Current Exotic weapon source unavailable in the Bungie manifest",
    steps: source
      ? [`Complete the published requirement for ${source} and claim ${name} from its final reward.`]
      : [`Search the Monument to Lost Lights in the Tower for ${name}.`, "If it is not archived there, use its current Exotic quest or mission rather than spending materials on a different item."],
    prerequisites: []
  };
}

function curatedAcquisitionGuide(item: CompactManifest["items"][number]): GuideEntry | undefined {
  if (item.name === "Cull's Shadow") return {
    itemHash: item.itemHash,
    acquisition: "Oblation: Bloodline Exotic Mission",
    steps: [
      "Launch The Scarlet Keep with a Weapon of Sorrow equipped and destroy the hidden runes during the final encounter.",
      "Enter the opened room, interact with the Hive object, then follow the Soulfire Frequency trails across the Moon patrol zones.",
      "Finish the Moon investigation to reveal Oblation: Bloodline, then complete the Exotic Mission and claim Cull's Shadow."
    ],
    prerequisites: ["Have access to the Moon and The Scarlet Keep.", "Bring a Weapon of Sorrow such as Thorn, Osteo Striga, Necrochasm, or Touch of Malice."],
    confidence: "verified",
    verifiedAt: "2026-07-30",
    sources: [{ label: "Current Oblation: Bloodline guide", url: "https://games.gg/destiny-2/guides/destiny-2-how-to-get-culls-shadow/" }]
  };
  if (item.name === "Wolfsbane") return {
    itemHash: item.itemHash,
    acquisition: "Heliostat Exotic Mission",
    steps: ["Open the Portal and select Heliostat from Pinnacle Ops.", "Complete Heliostat and claim Wolfsbane from the mission reward."],
    prerequisites: ["Own the content entitlement required to launch Heliostat."],
    confidence: "verified",
    verifiedAt: "2026-07-30",
    sources: [{ label: "Bungie Heliostat announcement", url: "https://www.bungie.net/7/en/News/Article/twid_10_09_2025" }]
  };
  return undefined;
}

export function mergeCollection(
  manifest: CompactManifest,
  state: {
    ownedCollectibleHashes: ReadonlySet<string>;
    completedRecordHashes: ReadonlySet<string>;
    visibleRecordHashes: ReadonlySet<string>;
    ownedItemHashes?: ReadonlySet<string>;
    xurSaleItemHashes?: ReadonlySet<string>;
  },
  selectedClass?: GuardianClass,
  guides: Record<string, GuideEntry> = {}
): ExoticCollectionEntry[] {
  const grouped = new Map<string, CompactManifest["items"]>();
  for (const item of manifest.items.filter((entry) => entry.kind === "weapon" || !selectedClass || entry.className === selectedClass)) {
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
      const catalystComplete = catalystAvailable && catalystRecordHashes.every((hash) => state.completedRecordHashes.has(hash));
      const catalystOwned = catalystRecordHashes.some((hash) => state.visibleRecordHashes.has(hash));
      const owned = catalystOwned || catalystComplete || variants.some((variant) =>
        Boolean(variant.collectibleHash && state.ownedCollectibleHashes.has(variant.collectibleHash))
        || Boolean(state.ownedItemHashes?.has(variant.itemHash))
      );
      const xurSelling = variants.some((variant) => state.xurSaleItemHashes?.has(variant.itemHash));
      const guideSource = variants.find((variant) => variant.source.trim()) || item;
      const guide = variants.map((variant) => guides[variant.itemHash]).find(Boolean)
        ?? fallbackGuide({ ...item, source: guideSource.source, catalystRecordHashes });
      const catalysts = catalystRecordHashes.map((recordHash) => {
        const definition = manifest.recordDefinitions[recordHash] as any;
        const properties = definition?.displayProperties || {};
        const complete = state.completedRecordHashes.has(recordHash);
        const obtained = state.visibleRecordHashes.has(recordHash);
        return {
          recordHash,
          name: String(properties.name || `${item.name} Catalyst`),
          description: String(properties.description || "Open the catalyst record in Destiny for its current objective."),
          icon: imageUrl(properties.icon),
          state: complete ? "complete" as const : obtained ? "obtained" as const : "missing" as const
        };
      });
      const features = collectionFeatures(manifest, variants.map((variant) => variant.itemHash));
      return {
        ...item,
        icon: imageUrl(item.icon),
        watermark: imageUrl(item.watermark),
        owned,
        catalyst: !catalystAvailable ? "unavailable" : catalystComplete ? "complete" : catalystOwned ? "obtained" : "missing",
        xurSelling,
        catalysts,
        features,
        guide
      } satisfies ExoticCollectionEntry;
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
}

function collectionFeatures(manifest: CompactManifest, itemHashes: string[]): CollectionFeature[] {
  const ignored = /^(empty |default )|ornament|shader|kill tracker|masterwork/i;
  const features = new Map<string, CollectionFeature>();
  for (const itemHash of itemHashes) {
    for (const feature of manifest.collectionFeatureDefinitions?.[itemHash] || []) features.set(feature.itemHash, { ...feature, icon: imageUrl(feature.icon) });
    const definition = manifest.itemDefinitions[itemHash] as any;
    for (const socket of definition?.sockets?.socketEntries || []) {
      const hashes = [socket?.singleInitialItemHash, ...(socket?.reusablePlugItems || []).map((plug: any) => plug?.plugItemHash || plug?.itemHash)]
        .map(String).filter((hash) => hash && hash !== "0");
      for (const hash of hashes) {
        const plug = manifest.itemDefinitions[hash] as any;
        const properties = plug?.displayProperties || {};
        const name = String(properties.name || "").trim();
        if (!name || ignored.test(name)) continue;
        features.set(hash, {
          itemHash: hash,
          name,
          description: String(properties.description || "Additional item socket or selectable feature."),
          icon: imageUrl(properties.icon)
        });
      }
    }
  }
  return [...features.values()];
}

function representativeScore(item: CompactManifest["items"][number]): number {
  return (item.collectibleHash ? 8 : 0)
    + (item.source ? 4 : 0)
    + (item.description ? 2 : 0)
    + (item.icon ? 1 : 0);
}
