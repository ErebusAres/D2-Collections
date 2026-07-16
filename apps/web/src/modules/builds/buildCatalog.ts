import type { BuildCatalogData, BuildCatalogEntry, BuildCatalogKind, BuildGuardianClass, BuildNamedEntry, BuildSubclass } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue } from "react";
import { api } from "../../services/api/client";

export interface BuildCatalogQuery {
  kind: BuildCatalogKind;
  query: string;
  classType?: BuildGuardianClass;
  subclass?: BuildSubclass;
  slot?: "helmet" | "arms" | "chest" | "legs" | "classItem";
  enabled?: boolean;
}

export function useBuildCatalog(input: BuildCatalogQuery) {
  const query = useDeferredValue(input.query.trim());
  const parameters = new URLSearchParams({ kind: input.kind });
  if (query) parameters.set("q", query);
  if (input.classType) parameters.set("classType", input.classType);
  if (input.subclass) parameters.set("subclass", input.subclass);
  if (input.slot) parameters.set("slot", input.slot);
  return useQuery({
    queryKey: ["build-catalog", input.kind, query, input.classType, input.subclass, input.slot],
    queryFn: () => api<BuildCatalogData>(`/api/v1/builds/catalog?${parameters.toString()}`),
    enabled: input.enabled !== false && (input.kind !== "icon" || query.length >= 2),
    staleTime: 10 * 60_000
  });
}

export function namedEntryFromCatalog(entry: BuildCatalogEntry): BuildNamedEntry {
  return {
    hash: entry.hash,
    name: entry.name,
    icon: entry.icon,
    itemType: entry.itemType || undefined,
    rarity: entry.rarity || undefined,
    damageType: entry.damageType || undefined
  };
}
