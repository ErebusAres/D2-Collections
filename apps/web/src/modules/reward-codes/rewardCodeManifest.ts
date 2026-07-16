import { imageUrl } from "@guardian-nexus/domain";
import { useQuery } from "@tanstack/react-query";

export interface RewardCodeManifestItem {
  itemHash: string;
  collectibleHash: string;
  name: string;
  icon: string;
  itemType: string;
}

interface RewardCodeManifestDefinition {
  reward: string;
  items: RewardCodeManifestItem[];
}

interface RewardCodeManifest {
  version: string;
  generatedAt: string;
  definitions: Record<string, RewardCodeManifestDefinition>;
}

async function loadRewardCodeManifest(): Promise<RewardCodeManifest> {
  const response = await fetch("/data/reward-code-manifest.json");
  if (!response.ok) throw new Error(`Reward preview manifest returned ${response.status}.`);
  const manifest = await response.json() as RewardCodeManifest;
  if (!manifest?.definitions || typeof manifest.definitions !== "object") throw new Error("Reward preview manifest is invalid.");
  return manifest;
}

export function useRewardCodeManifest() {
  return useQuery({
    queryKey: ["reward-code-manifest"],
    queryFn: loadRewardCodeManifest,
    staleTime: 15 * 60_000,
    retry: 1
  });
}

export function rewardCodeManifestItems(manifest: RewardCodeManifest | undefined, code: string): RewardCodeManifestItem[] {
  return (manifest?.definitions[code]?.items || [])
    .filter((item) => Boolean(item.name && item.icon))
    .map((item) => ({ ...item, icon: imageUrl(item.icon) }));
}
