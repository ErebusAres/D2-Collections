import type { BuildCatalogEntry, BuildNamedEntry } from "@guardian-nexus/contracts";

export const ARTIFACT_SLOT_ACCESS = [1, 1, 2, 2, 2, 3, 3] as const;

export interface ArtifactPerkSlot {
  slot: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  maxTier: 1 | 2 | 3;
  perk?: BuildNamedEntry;
}

export function resolveArtifactPerkSlots(values: BuildNamedEntry[], catalog: BuildCatalogEntry[]): ArtifactPerkSlot[] {
  const tiers = new Map(catalog.map((entry) => [entry.hash, entry.artifactTier]));
  const slots: ArtifactPerkSlot[] = ARTIFACT_SLOT_ACCESS.map((maxTier, index) => ({ slot: (index + 1) as ArtifactPerkSlot["slot"], maxTier }));
  const remaining: BuildNamedEntry[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const identity = artifactPerkIdentity(value);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const artifactTier = value.artifactTier || (value.hash ? tiers.get(value.hash) : undefined);
    const perk = artifactTier ? { ...value, artifactTier } : value;
    const requested = perk.artifactSlot ? slots[perk.artifactSlot - 1] : undefined;
    if (requested && !requested.perk && (!artifactTier || artifactTier <= requested.maxTier)) requested.perk = perk;
    else remaining.push(perk);
  }

  for (const perk of remaining) {
    const slot = slots.find((candidate) => !candidate.perk && (!perk.artifactTier || perk.artifactTier <= candidate.maxTier));
    if (slot) slot.perk = perk;
  }
  return slots;
}

export function serializeArtifactPerkSlots(slots: ArtifactPerkSlot[]): BuildNamedEntry[] {
  return slots.flatMap(({ slot, perk }) => perk ? [{ ...perk, artifactSlot: slot }] : []);
}

export function artifactPerkIdentity(value: Pick<BuildNamedEntry, "hash" | "name">): string {
  return value.hash ? `hash:${value.hash}` : `name:${value.name.trim().toLocaleLowerCase()}`;
}
