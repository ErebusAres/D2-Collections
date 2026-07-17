import type { BuildArmorSlot, BuildCatalogChunk, BuildCatalogData, BuildCatalogEntry, BuildCatalogKind, BuildCatalogManifest, BuildGuardianClass, BuildNamedEntry, BuildSubclass, GuardianBuild } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo } from "react";

export interface BuildCatalogQuery {
  kind: BuildCatalogKind;
  query: string;
  classType?: BuildGuardianClass;
  subclass?: BuildSubclass;
  slot?: BuildArmorSlot;
  itemHash?: string;
  spiritRow?: 1 | 2;
  enabled?: boolean;
}

export function useBuildCatalog(input: BuildCatalogQuery) {
  const query = useDeferredValue(input.query.trim());
  const enabled = input.enabled !== false && (!["icon", "noteIcon"].includes(input.kind) || query.length >= 2);
  const index = useQuery({
    queryKey: ["build-catalog-index"],
    queryFn: () => staticJson<BuildCatalogManifest>("/data/build-catalog.json"),
    enabled,
    staleTime: Infinity
  });
  const path = index.data?.groups[input.kind];
  const chunk = useQuery({
    queryKey: ["build-catalog-chunk", path],
    queryFn: () => staticJson<BuildCatalogChunk>(`/data/${path}`),
    enabled: enabled && Boolean(path),
    staleTime: Infinity
  });
  const data = useMemo(() => chunk.data && index.data ? {
    data: {
      manifestVersion: index.data.version,
      available: true,
      results: searchBuildCatalogChunk(chunk.data, { ...input, query })
    } satisfies BuildCatalogData
  } : undefined, [chunk.data, index.data, input.kind, input.classType, input.subclass, input.slot, input.itemHash, input.spiritRow, query]);
  return {
    data,
    isLoading: enabled && (index.isLoading || Boolean(path) && chunk.isLoading),
    error: index.error || chunk.error
  };
}

export function useBuildArmorTraits(build: GuardianBuild | undefined): GuardianBuild | undefined {
  const index = useQuery({ queryKey: ["build-catalog-index"], queryFn: () => staticJson<BuildCatalogManifest>("/data/build-catalog.json"), enabled: Boolean(build), staleTime: Infinity });
  const path = index.data?.groups.armorTrait;
  const traits = useQuery({ queryKey: ["build-catalog-chunk", path], queryFn: () => staticJson<BuildCatalogChunk>(`/data/${path}`), enabled: Boolean(build && path), staleTime: Infinity });
  return useMemo(() => {
    if (!build || !traits.data) return build;
    const byHash = new Map(traits.data.entries.map((entry) => [entry.hash, entry.traits || []]));
    return { ...build, equipment: { ...build.equipment, armor: build.equipment.armor.map((entry) => entry.traits?.length || !entry.hash ? entry : { ...entry, traits: byHash.get(entry.hash) || [] }) } };
  }, [build, traits.data]);
}

export function searchBuildCatalogChunk(chunk: BuildCatalogChunk, input: Omit<BuildCatalogQuery, "enabled">): BuildCatalogEntry[] {
  const query = input.query.trim().toLocaleLowerCase();
  const allowedPerks = input.kind === "weaponPerk" && input.itemHash
    ? new Set(chunk.weaponPerkHashes?.[input.itemHash] || [])
    : undefined;
  const spiritPool = input.kind === "exoticSpirit"
    ? input.itemHash && chunk.spiritHashes?.[input.itemHash] || input.classType && chunk.spiritHashesByClass?.[input.classType]
    : undefined;
  const allowedSpirits = spiritPool && input.spiritRow
    ? new Set(spiritPool[input.spiritRow === 1 ? "row1" : "row2"])
    : undefined;
  const seen = new Set<string>();
  return chunk.entries.filter((entry) => {
    if (allowedPerks && !allowedPerks.has(entry.hash)) return false;
    if (allowedSpirits && !allowedSpirits.has(entry.hash)) return false;
    if (input.classType && entry.classType && entry.classType !== input.classType) return false;
    if ((input.kind === "class" || input.kind === "subclass" || input.kind === "armor") && input.classType && entry.classType !== input.classType) return false;
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

export function namedEntryFromCatalog(entry: BuildCatalogEntry): BuildNamedEntry {
  return {
    hash: entry.hash,
    name: entry.name,
    icon: entry.icon,
    itemType: entry.itemType || undefined,
    rarity: entry.rarity || undefined,
    damageType: entry.damageType || undefined,
    description: entry.description || undefined,
    setName: entry.setName,
    requiredPieces: entry.requiredPieces,
    bonuses: entry.bonuses,
    row: entry.row
  };
}

async function staticJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Destiny build catalog request returned ${response.status}.`);
  return response.json() as Promise<T>;
}

function abilityKind(kind: BuildCatalogKind): boolean {
  return ["super", "classAbility", "movement", "melee", "grenade", "aspect", "fragment"].includes(kind);
}
