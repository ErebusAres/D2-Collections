import catalog from "./rewardCodesCatalog.json";

export type RewardCodeKind = "Emblem" | "Shader" | "Emote" | "Transmat" | "Ornament" | "Ghost Shell" | "Sparrow" | "Ship" | "Legacy reward";

export interface RewardCode {
  code: string;
  reward: string;
  kind: RewardCodeKind;
  verifiedAt: string;
  expiresAt?: string;
  featured?: boolean;
  sourceUrl: string;
}

const REDEEM_URL = "https://www.bungie.net/7/en/Codes/Redeem";

export const rewardCodes: RewardCode[] = catalog.map((entry) => ({
  ...entry,
  kind: entry.kind as RewardCodeKind
}));

export function activeRewardCodes(now = new Date()): RewardCode[] {
  return rewardCodes.filter((entry) => !entry.expiresAt || Date.parse(entry.expiresAt) > now.getTime());
}

export function featuredRewardCodes(now = new Date()): RewardCode[] {
  return activeRewardCodes(now).filter((entry) => entry.featured);
}

export function rewardCodeRedemptionUrl(code?: string): string {
  if (!code) return REDEEM_URL;
  const url = new URL(REDEEM_URL);
  url.searchParams.set("token", code);
  return url.toString();
}
