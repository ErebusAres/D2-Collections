import type { ActivityHistoryData, ActivityHistoryEntry, ActivityHistoryKind, GuardianClass } from "@guardian-nexus/contracts";

const modeNames: Record<number, string> = {
  2: "Story", 3: "Strike", 4: "Raid", 5: "Crucible", 6: "Patrol", 10: "Control", 12: "Clash", 18: "Strike",
  19: "Iron Banner", 31: "Supremacy", 32: "Private match", 37: "Survival", 46: "Rumble", 48: "Doubles", 63: "Gambit",
  69: "Competitive", 71: "Quickplay", 73: "Gambit", 75: "Trials", 82: "Dungeon", 84: "Trials", 88: "Rift"
};
const pvpModes = new Set([5, 10, 12, 19, 31, 32, 37, 46, 48, 69, 71, 75, 84, 88]);
const gambitModes = new Set([63, 73]);

export function normalizeActivityHistory(args: {
  rows: Array<{ characterId: string; activity: any }>;
  characterClasses: Record<string, GuardianClass>;
  activityDefinitions: Record<string, any>;
  manifestVersion: string;
  returnedCharacters: number;
  totalCharacters: number;
}): ActivityHistoryData {
  const unique = new Map<string, ActivityHistoryEntry>();
  for (const { characterId, activity } of args.rows) {
    const details = activity?.activityDetails || {};
    const period = validDate(activity?.period);
    if (!period) continue;
    const activityHash = String(details.referenceId || details.directorActivityHash || "0");
    const definition = args.activityDefinitions[activityHash] || args.activityDefinitions[String(details.directorActivityHash || "")];
    const properties = definition?.displayProperties || {};
    const modes = [details.mode, ...(Array.isArray(details.modes) ? details.modes : [])].map(Number).filter(Number.isFinite);
    const mode = modes.at(-1);
    const instanceId = String(details.instanceId || `${period}:${characterId}:${activityHash}`);
    if (unique.has(instanceId)) continue;
    unique.set(instanceId, {
      instanceId, characterId, characterClass: args.characterClasses[characterId] || "Unknown", period, activityHash,
      activityName: clean(properties.name, 120) || "Activity name unavailable",
      activityDescription: clean(properties.description, 300) || undefined,
      kind: activityKind(modes), mode, modeName: mode === undefined ? "Mode unavailable" : modeNames[mode] || `Mode ${mode}`,
      completed: stat(activity?.values, "completed", true), durationSeconds: stat(activity?.values, "activityDurationSeconds"),
      score: stat(activity?.values, "score"), kills: stat(activity?.values, "kills"), deaths: stat(activity?.values, "deaths"), assists: stat(activity?.values, "assists")
    });
  }
  const activities = [...unique.values()].sort((a, b) => Date.parse(b.period) - Date.parse(a.period)).slice(0, 50);
  const state = args.returnedCharacters === 0 ? "unavailable" : args.returnedCharacters < args.totalCharacters ? "partial" : activities.length ? "available" : "empty";
  return {
    manifestVersion: args.manifestVersion, state, activities, returnedCharacters: args.returnedCharacters, totalCharacters: args.totalCharacters,
    sources: { activities: "Destiny2.GetActivityHistory for each current character", definitions: "DestinyActivityDefinition manifest data" }
  };
}

function activityKind(modes: number[]): ActivityHistoryKind {
  if (modes.some((mode) => pvpModes.has(mode))) return "pvp";
  if (modes.some((mode) => gambitModes.has(mode))) return "gambit";
  if (modes.length) return "pve";
  return "other";
}

function stat(values: any, key: string, boolean: true): boolean | undefined;
function stat(values: any, key: string, boolean?: false): number | undefined;
function stat(values: any, key: string, boolean = false): number | boolean | undefined {
  const raw = values?.[key]?.basic?.value;
  const value = Number(raw);
  if (!Number.isFinite(value)) return undefined;
  return boolean ? value > 0 : value;
}
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validDate(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined; }
