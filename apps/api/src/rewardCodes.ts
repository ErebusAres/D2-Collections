import type { RewardCodeStatusData } from "@guardian-nexus/contracts";
import type { RewardCodeManifest } from "./bungie";

const LIMITATION = "Bungie does not expose universal code-redemption history. Guardian Nexus only auto-hides a code when its exact reward is acquired in Destiny Collections.";

function collectibleStates(profile: any): Map<string, number> {
  const states = new Map<string, number>();
  const apply = (component: any) => Object.entries(component?.collectibles || {}).forEach(([hash, row]: [string, any]) => {
    states.set(hash, Number(row?.state || 0));
  });
  apply(profile?.profileCollectibles?.data);
  Object.values(profile?.characterCollectibles?.data || {}).forEach(apply);
  return states;
}

export function normalizeRewardCodeStatus(profile: any, manifest: RewardCodeManifest, checkedAt = new Date().toISOString()): RewardCodeStatusData {
  const states = collectibleStates(profile);
  const componentAvailable = !profile?.profileCollectibles?.disabled && Boolean(profile?.profileCollectibles?.data || profile?.characterCollectibles?.data);
  const manifestAvailable = manifest.version !== "unavailable" && Object.keys(manifest.definitions).length > 0;

  return {
    manifestVersion: manifest.version,
    source: "bungie-profile-collectibles",
    checkedAt,
    manualCodes: [],
    manualCodesConfigured: false,
    limitation: LIMITATION,
    statuses: Object.entries(manifest.definitions).map(([code, definition]) => {
      const hashes = [...new Set(definition.items.map((item) => String(item.collectibleHash || "")).filter(Boolean))];
      if (!manifestAvailable) return { code, reward: definition.reward, state: "unavailable", matchedCollectibleHashes: hashes, reason: "Reward-code manifest is unavailable." };
      if (!hashes.length) return { code, reward: definition.reward, state: "unavailable", matchedCollectibleHashes: [], reason: "Bungie manifest has no exact collectible mapping for this reward." };
      if (!componentAvailable) return { code, reward: definition.reward, state: "unavailable", matchedCollectibleHashes: hashes, reason: "Bungie did not return profile collectibles for this account." };
      const owned = hashes.some((hash) => (Number(states.get(hash) ?? 1) & 1) === 0);
      return { code, reward: definition.reward, state: owned ? "reward-owned" : "not-owned", matchedCollectibleHashes: hashes };
    })
  };
}
