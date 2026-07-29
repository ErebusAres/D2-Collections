import type { PvpData, PvpModeStats, PvpProgression, PvpProgressionKind, RewardsManifest } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";

const modeDefinitions: Array<{ kind: PvpModeStats["kind"]; name: string; mode: number; aliases: string[]; aggregateAlias?: string }> = [
  { kind: "all", name: "All Crucible", mode: 5, aliases: ["allPvP"] },
  { kind: "competitive", name: "Competitive", mode: 69, aliases: ["pvpCompetitive", "competitive"] },
  { kind: "trials", name: "Trials of Osiris", mode: 84, aliases: ["trialsOfOsiris"] },
  {
    kind: "iron-banner",
    name: "Iron Banner",
    mode: 19,
    aggregateAlias: "ironBanner",
    aliases: [
      "ironBanner",
      "ironBannerControl",
      "ironBannerClash",
      "ironBannerSupremacy",
      "ironBannerSalvage",
      "ironBannerRift",
      "ironBannerZoneControl",
      "ironBannerRecent"
    ]
  }
];

const progressionOrder: PvpProgressionKind[] = ["crucible", "competitive", "trials", "iron-banner"];

export function normalizePvpProgressions(profile: any, manifest: RewardsManifest, characterId?: string): PvpProgression[] {
  const definitions = manifest.pvpProgressionDefinitions || {};
  const rows: PvpProgression[] = [];
  for (const [progressionHash, definition] of Object.entries(definitions)) {
    const kind = pvpKind(definition);
    if (!kind) continue;
    const live = liveProgression(profile, progressionHash, characterId);
    if (!live) continue;
    const steps = Array.isArray((definition as any)?.steps) ? (definition as any).steps : [];
    const stepIndex = Math.max(0, integer(live?.stepIndex, live?.level));
    const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))] || {};
    const progressToNextLevel = nonNegative(live?.progressToNextLevel);
    const nextLevelAt = nonNegative(live?.nextLevelAt);
    const properties = (definition as any)?.displayProperties || {};
    rows.push({
      kind,
      progressionHash,
      name: String(properties.name || labelForKind(kind)),
      description: String(properties.description || (definition as any)?.source || ""),
      icon: imageUrl(String(step.icon || properties.icon || "")),
      rankName: String(step.stepName || `Rank ${nonNegative(live?.level)}`),
      level: nonNegative(live?.level),
      stepIndex,
      currentProgress: nonNegative(live?.currentProgress),
      progressToNextLevel,
      ...(nextLevelAt ? { nextLevelAt, percent: Math.max(0, Math.min(100, Math.floor((progressToNextLevel / nextLevelAt) * 100))) } : {}),
      resets: nonNegative(live?.currentResetCount)
    });
  }
  return progressionOrder.flatMap((kind) => rows
    .filter((row) => row.kind === kind)
    .sort((left, right) => right.level - left.level || right.currentProgress - left.currentProgress)
    .slice(0, 1));
}

export function normalizePvpData(args: {
  profile: any;
  manifest: RewardsManifest;
  characterId: string;
  historicalStats: any[];
}): PvpData {
  const progressions = normalizePvpProgressions(args.profile, args.manifest, args.characterId);
  const modes = modeDefinitions.map((definition) => normalizeMode(definition, args.historicalStats));
  const overall = modes[0]!;
  return {
    characterId: args.characterId,
    manifestVersion: args.manifest.version,
    primaryRank: progressions.find((entry) => entry.kind === "crucible"),
    progressions,
    overall,
    modes: modes.slice(1),
    hasActivity: overall.matches > 0,
    sources: {
      ranks: "Destiny2.GetProfile characterProgressions (component 202) and DestinyProgressionDefinition manifest data",
      stats: "Destiny2.GetHistoricalStats across the account's characters"
    }
  };
}

export function ironBannerHistoryResponse(activities: any[]): any {
  const ironBannerModes = new Set([19, 43, 44, 45, 68, 90, 91]);
  const unique = new Map<string, any>();
  for (const activity of activities) {
    const details = activity?.activityDetails || {};
    const modes = [details.mode, ...(Array.isArray(details.modes) ? details.modes : [])].map(Number);
    if (!modes.some((mode) => ironBannerModes.has(mode))) continue;
    const key = String(details.instanceId || `${activity?.period || ""}:${details.referenceId || ""}`);
    if (!unique.has(key)) unique.set(key, activity);
  }
  if (!unique.size) return {};
  const rows = [...unique.values()];
  const value = (key: string) => rows.reduce((total, activity) => total + stat(activity?.values, key), 0);
  return { ironBannerRecent: { allTime: {
    activitiesEntered: basic(rows.length),
    activitiesWon: basic(rows.filter((activity) => stat(activity?.values, "standing") === 0).length),
    kills: basic(value("kills")),
    deaths: basic(value("deaths")),
    assists: basic(value("assists")),
    precisionKills: basic(value("precisionKills")),
    bestSingleGameKills: basic(Math.max(0, ...rows.map((activity) => stat(activity?.values, "kills")))),
    longestKillSpree: basic(Math.max(0, ...rows.map((activity) => stat(activity?.values, "longestKillSpree"))))
  } } };
}

function normalizeMode(definition: typeof modeDefinitions[number], responses: any[]): PvpModeStats {
  const hasIronBannerAggregate = definition.kind === "iron-banner"
    && responses.some((response) => stat(response?.ironBanner?.allTime, "activitiesEntered") > 0);
  const sourceResponses = hasIronBannerAggregate
    ? responses.filter((response) => !response?.ironBannerRecent)
    : responses;
  const rows = sourceResponses.flatMap((response) => modeRows(response, definition));
  const matches = sum(rows, "activitiesEntered");
  const wins = sum(rows, "activitiesWon");
  const kills = sum(rows, "kills");
  const deaths = sum(rows, "deaths");
  const assists = sum(rows, "assists");
  const combatRatings = rows
    .map((row) => ({ value: stat(row, "combatRating"), weight: Math.max(1, stat(row, "activitiesEntered")) }))
    .filter((entry) => entry.value > 0);
  const combatRatingWeight = combatRatings.reduce((total, entry) => total + entry.weight, 0);
  const combatRating = combatRatingWeight
    ? round(combatRatings.reduce((total, entry) => total + entry.value * entry.weight, 0) / combatRatingWeight)
    : undefined;
  return {
    kind: definition.kind,
    name: definition.name,
    mode: definition.mode,
    matches,
    wins,
    winRate: matches ? round((wins / matches) * 100) : 0,
    kills,
    deaths,
    assists,
    kd: deaths ? round(kills / deaths) : kills,
    efficiency: deaths ? round((kills + assists) / deaths) : kills + assists,
    precisionKills: sum(rows, "precisionKills"),
    bestSingleGameKills: maximum(rows, "bestSingleGameKills"),
    longestKillSpree: maximum(rows, "longestKillSpree"),
    ...(combatRating !== undefined ? { combatRating } : {})
  };
}

function modeRows(response: any, definition: typeof modeDefinitions[number]): any[] {
  const aggregate = definition.aggregateAlias ? response?.[definition.aggregateAlias]?.allTime : undefined;
  if (aggregate && stat(aggregate, "activitiesEntered") > 0) return [aggregate];
  return definition.aliases
    .map((alias) => response?.[alias]?.allTime)
    .filter(Boolean);
}

function liveProgression(profile: any, progressionHash: string, characterId?: string): any | undefined {
  const selected = characterId ? profile?.characterProgressions?.data?.[characterId]?.progressions?.[progressionHash] : undefined;
  if (selected) return selected;
  return Object.values(profile?.characterProgressions?.data || {})
    .map((component: any) => component?.progressions?.[progressionHash])
    .filter(Boolean)
    .sort((left: any, right: any) => nonNegative(right?.level) - nonNegative(left?.level)
      || nonNegative(right?.currentProgress) - nonNegative(left?.currentProgress))[0];
}

function pvpKind(definition: Record<string, unknown>): PvpProgressionKind | undefined {
  const kind = String((definition as any)?.kind || "");
  return progressionOrder.includes(kind as PvpProgressionKind) ? kind as PvpProgressionKind : undefined;
}

function labelForKind(kind: PvpProgressionKind): string {
  return ({ crucible: "Crucible Rank", competitive: "Competitive Division", trials: "Trials of Osiris", "iron-banner": "Iron Banner" } as const)[kind];
}

function stat(row: any, key: string): number {
  const value = row?.[key]?.basic?.value ?? row?.[key]?.pga?.value ?? row?.[key]?.value;
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function sum(rows: any[], key: string): number {
  return Math.max(0, Math.round(rows.reduce((total, row) => total + stat(row, key), 0)));
}

function maximum(rows: any[], key: string): number {
  return Math.max(0, ...rows.map((row) => Math.round(stat(row, key))));
}

function nonNegative(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function integer(value: unknown, fallback: unknown): number {
  const number = Number(value ?? fallback ?? 0);
  return Number.isFinite(number) ? Math.floor(number) : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function basic(value: number): { basic: { value: number } } {
  return { basic: { value } };
}
