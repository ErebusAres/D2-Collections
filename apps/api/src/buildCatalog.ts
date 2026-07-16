import type { BuildCatalogChunk, BuildCatalogData, BuildCatalogEntry, BuildCatalogKind, BuildCatalogManifest } from "@guardian-nexus/contracts";
import { z } from "zod";
import type { Env } from "./types";

const querySchema = z.object({
  kind: z.enum(["subclass", "super", "classAbility", "movement", "melee", "grenade", "aspect", "fragment", "weapon", "weaponPerk", "armor", "armorTrait", "exoticSpirit", "armorMod", "armorSetBonus", "artifact", "artifactPerk", "champion", "cosmetic", "icon"]),
  q: z.string().trim().max(100).default(""),
  classType: z.enum(["hunter", "titan", "warlock"]).optional(),
  subclass: z.enum(["prismatic", "arc", "solar", "void", "strand", "stasis"]).optional(),
  slot: z.enum(["helmet", "arms", "chest", "legs", "classItem"]).optional(),
  itemHash: z.string().trim().regex(/^\d+$/).optional(),
  spiritRow: z.coerce.number().int().min(1).max(2).optional()
});

let indexCache: { value: BuildCatalogManifest; expiresAt: number } | undefined;
const chunkCache = new Map<string, { value: BuildCatalogChunk; expiresAt: number }>();

export async function loadBuildCatalog(url: URL, env: Env): Promise<BuildCatalogData> {
  const input = querySchema.parse(Object.fromEntries(url.searchParams));
  try {
    const index = await loadIndex(env);
    const path = index.groups[input.kind];
    if (!path) return { manifestVersion: index.version, available: true, results: [] };
    const chunk = await loadChunk(path, env);
    return { manifestVersion: index.version, available: true, results: searchBuildCatalog(chunk, input) };
  } catch {
    return {
      manifestVersion: "unavailable",
      available: false,
      warning: "The cached Destiny build catalog is temporarily unavailable. Manual fallback remains available.",
      results: []
    };
  }
}

export function searchBuildCatalog(chunk: BuildCatalogChunk, input: z.infer<typeof querySchema>): BuildCatalogEntry[] {
  const query = input.q.toLocaleLowerCase();
  const allowedPerks = input.kind === "weaponPerk" && input.itemHash
    ? new Set(chunk.weaponPerkHashes?.[input.itemHash] || [])
    : undefined;
  const allowedSpirits = input.kind === "exoticSpirit" && input.itemHash && input.spiritRow
    ? new Set(chunk.spiritHashes?.[input.itemHash]?.[input.spiritRow === 1 ? "row1" : "row2"] || [])
    : undefined;
  const seen = new Set<string>();
  return chunk.entries.filter((entry) => {
    if (allowedPerks && !allowedPerks.has(entry.hash)) return false;
    if (allowedSpirits && !allowedSpirits.has(entry.hash)) return false;
    if (input.classType && entry.classType && entry.classType !== input.classType) return false;
    if ((input.kind === "subclass" || input.kind === "armor") && input.classType && entry.classType !== input.classType) return false;
    if (input.subclass && abilityKind(input.kind) && entry.subclass !== input.subclass) return false;
    if (input.slot && input.kind === "armorMod" && !entry.applicableSlots?.includes(input.slot)) return false;
    const search = `${entry.name} ${entry.itemType} ${entry.description} ${entry.rarity} ${entry.slot} ${entry.damageType} ${entry.setName || ""}`.toLocaleLowerCase();
    if (query && !search.includes(query)) return false;
    const key = entry.kind === "armorMod"
      ? `${entry.kind}:${entry.name.toLocaleLowerCase()}:${(entry.applicableSlots || []).join(",")}`
      : `${entry.kind}:${entry.name.toLocaleLowerCase()}:${entry.hash}:${entry.requiredPieces || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => {
    const leftExact = query && left.name.toLocaleLowerCase() === query ? 0 : query && left.name.toLocaleLowerCase().startsWith(query) ? 1 : 2;
    const rightExact = query && right.name.toLocaleLowerCase() === query ? 0 : query && right.name.toLocaleLowerCase().startsWith(query) ? 1 : 2;
    return leftExact - rightExact || Number(right.exotic) - Number(left.exotic) || left.name.localeCompare(right.name) || Number(left.requiredPieces || 0) - Number(right.requiredPieces || 0);
  }).slice(0, 60);
}

async function loadIndex(env: Env): Promise<BuildCatalogManifest> {
  if (indexCache && indexCache.expiresAt > Date.now()) return indexCache.value;
  const value = await catalogJson<BuildCatalogManifest>(catalogUrl("build-catalog.json", env));
  if (!value.version || !value.groups) throw new Error("Build catalog index is invalid.");
  indexCache = { value, expiresAt: Date.now() + 10 * 60_000 };
  return value;
}

async function loadChunk(path: string, env: Env): Promise<BuildCatalogChunk> {
  const cached = chunkCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await catalogJson<BuildCatalogChunk>(catalogUrl(path, env));
  if (!value.version || !Array.isArray(value.entries)) throw new Error("Build catalog chunk is invalid.");
  chunkCache.set(path, { value, expiresAt: Date.now() + 10 * 60_000 });
  return value;
}

async function catalogJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cf: { cacheTtl: 600, cacheEverything: true } });
  if (!response.ok) throw new Error(`Build catalog request returned ${response.status}.`);
  return response.json() as Promise<T>;
}

function catalogUrl(path: string, env: Env): string {
  return new URL(path, env.GAME_DATA_URL).toString();
}

function abilityKind(kind: BuildCatalogKind): boolean {
  return ["super", "classAbility", "movement", "melee", "grenade", "aspect", "fragment"].includes(kind);
}
