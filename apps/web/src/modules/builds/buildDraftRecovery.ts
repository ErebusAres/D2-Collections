import type { BuildDocument } from "@guardian-nexus/contracts";

export const BUILD_RECOVERY_MAX_AGE_MS = 30 * 24 * 60 * 60_000;

export interface BuildRecoveryRecord { document: BuildDocument; savedAt: string }

export function buildRecoveryKey(membershipId: string, identifier: string): string {
  return `guardian-nexus:${membershipId}:build-recovery:${identifier || "new"}`;
}

export function readBuildRecovery(membershipId: string, identifier: string, now = Date.now()): BuildRecoveryRecord | undefined {
  try {
    const key = buildRecoveryKey(membershipId, identifier);
    const parsed = JSON.parse(localStorage.getItem(key) || "null") as BuildRecoveryRecord | null;
    if (!parsed?.document || !parsed.savedAt || now - Date.parse(parsed.savedAt) > BUILD_RECOVERY_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return undefined;
    }
    return parsed;
  } catch { return undefined; }
}

export function writeBuildRecovery(membershipId: string, identifier: string, document: BuildDocument, savedAt = new Date().toISOString()): void {
  localStorage.setItem(buildRecoveryKey(membershipId, identifier), JSON.stringify({ document, savedAt } satisfies BuildRecoveryRecord));
}

export function clearBuildRecovery(membershipId: string, identifier: string): void {
  localStorage.removeItem(buildRecoveryKey(membershipId, identifier));
}
