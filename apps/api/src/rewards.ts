import type { RewardsManifest, RewardsPassData, RewardsPassProgress, RewardsPassReward, RewardsPassRewardState } from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";

const REWARD_STATE_INVISIBLE = 1;
const REWARD_STATE_EARNED = 2;
const REWARD_STATE_CLAIMED = 4;
const REWARD_STATE_CLAIM_ALLOWED = 8;

export function normalizeRewardsPass(args: {
  profile: any;
  manifest: RewardsManifest;
  rank: number;
  progress: RewardsPassProgress;
  characterId?: string;
}): RewardsPassData {
  const passHash = args.progress.passHash || String(args.profile?.profile?.data?.currentSeasonPassHash || "");
  const pass = args.manifest.seasonPassDefinitions[passHash] as any;
  const progressionHashes = [
    args.progress.rewardProgressionHash || String(pass?.rewardProgressionHash || ""),
    args.progress.prestigeProgressionHash || String(pass?.prestigeProgressionHash || "")
  ].filter((value, index, values) => value && value !== "0" && values.indexOf(value) === index);
  const rewards = progressionHashes.flatMap((progressionHash) => {
    const definition = args.manifest.progressionDefinitions[progressionHash] as any;
    const live = liveProgression(args.profile, progressionHash, args.characterId);
    const stateRows = Array.isArray(live?.rewardItemStates) ? live.rewardItemStates : undefined;
    return (Array.isArray(definition?.rewardItems) ? definition.rewardItems : []).flatMap((reward: any): RewardsPassReward[] => {
      const itemHash = String(reward?.itemHash || "");
      const rewardItemIndex = Number(reward?.rewardItemIndex);
      if (!itemHash || !Number.isInteger(rewardItemIndex) || rewardItemIndex < 0) return [];
      const stateSupported = Boolean(stateRows && rewardItemIndex in stateRows);
      const stateFlags = stateSupported ? Number(stateRows![rewardItemIndex] || 0) : undefined;
      if (stateFlags !== undefined && (stateFlags & REWARD_STATE_INVISIBLE) !== 0) return [];
      const item = args.manifest.itemDefinitions[itemHash] as any;
      const properties = item?.displayProperties || {};
      return [{
        rewardItemIndex,
        itemHash,
        name: String(properties.name || "Bungie item definition unavailable"),
        description: String(properties.description || ""),
        icon: imageUrl(String(properties.icon || "")),
        quantity: Math.max(1, Number(reward?.quantity || 1)),
        requiredLevel: Math.max(0, Number(reward?.rewardedAtProgressionLevel || 0)),
        track: rewardTrack(String(reward?.uiDisplayStyle || "")),
        state: rewardState(stateFlags),
        ...(stateFlags === undefined ? {} : { stateFlags }),
        acquisition: Number(reward?.acquisitionBehavior) === 0 ? "instant" : Number(reward?.acquisitionBehavior) === 1 ? "claim-required" : "unknown"
      }];
    });
  }).sort((a, b) => a.requiredLevel - b.requiredLevel || a.rewardItemIndex - b.rewardItemIndex || a.name.localeCompare(b.name));
  const rewardDataState = args.manifest.version !== "unavailable" && Boolean(pass) && rewards.length ? "available" as const : "unavailable" as const;
  const rewardDataReason = rewardDataState === "available" ? undefined
    : args.manifest.version === "unavailable" ? "The Rewards Pass manifest could not be loaded."
    : !pass ? "The current season pass is not present in the deployed Bungie manifest."
    : "Bungie's progression definitions did not include visible rewards for this pass.";
  const properties = pass?.displayProperties || {};
  return {
    passHash,
    name: String(properties.name || "Current Rewards Pass"),
    description: String(properties.description || ""),
    icon: imageUrl(String(pass?.images?.iconImagePath || properties.icon || "")),
    backgroundImage: imageUrl(String(pass?.images?.themeBackgroundImagePath || "")),
    manifestVersion: args.manifest.version,
    rank: args.rank,
    progress: args.progress,
    rewards,
    rewardDataState,
    ...(rewardDataReason ? { rewardDataReason } : {}),
    sources: {
      rankAndXp: "Destiny2.GetProfile characterProgressions (component 202)",
      rewards: "DestinySeasonPassDefinition and DestinyProgressionDefinition manifest data",
      claimingSupported: false
    }
  };
}

function liveProgression(profile: any, progressionHash: string, characterId?: string): any {
  const selected = characterId ? profile?.characterProgressions?.data?.[characterId]?.progressions?.[progressionHash] : undefined;
  if (selected) return selected;
  return Object.values(profile?.characterProgressions?.data || {})
    .map((component: any) => component?.progressions?.[progressionHash])
    .filter(Boolean)
    .sort((a: any, b: any) => Number(b?.level || 0) - Number(a?.level || 0) || Number(b?.progressToNextLevel || 0) - Number(a?.progressToNextLevel || 0))[0];
}

function rewardState(flags: number | undefined): RewardsPassRewardState {
  if (flags === undefined) return "unavailable";
  if ((flags & REWARD_STATE_CLAIMED) !== 0) return "claimed";
  if ((flags & REWARD_STATE_EARNED) !== 0 && (flags & REWARD_STATE_CLAIM_ALLOWED) !== 0) return "available";
  if ((flags & REWARD_STATE_EARNED) !== 0) return "earned";
  return "locked";
}

function rewardTrack(uiDisplayStyle: string): string {
  const value = uiDisplayStyle.trim();
  if (!value) return "Track unavailable";
  const normalized = value.toLocaleLowerCase();
  if (normalized.includes("free")) return "Free track";
  if (normalized.includes("premium") || normalized.includes("paid")) return "Premium track";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}
