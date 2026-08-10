export type DiagnosticStatus = "pass" | "warning" | "fail" | "not-applicable";

export interface MembershipProbe {
  membershipType: number;
  membershipId: string;
  displayName: string;
  crossSaveOverride: number;
  applicableMembershipTypes: number[];
  isPublic?: boolean;
  isPrimary: boolean;
  succeeded: boolean;
  httpStatus?: number;
  bungieErrorCode?: number;
  bungieErrorStatus?: string;
  bungieMessage?: string;
  throttleSeconds?: number;
  profileExists: boolean;
  charactersExist: boolean;
  characterCount: number;
  characterIds: string[];
  dateLastPlayed?: string;
  usable: boolean;
}

export interface DiagnosticTest {
  id: string;
  name: string;
  status: DiagnosticStatus;
  durationMs: number;
  explanation: string;
  details?: Record<string, unknown>;
  httpStatus?: number;
  applicationCode?: string;
  bungieErrorCode?: number;
  bungieErrorStatus?: string;
  bungieMessage?: string;
  throttleSeconds?: number;
}

export function sanitizedMembershipProbe(probe: MembershipProbe): Omit<MembershipProbe, "membershipId" | "displayName" | "characterIds"> {
  return Object.fromEntries(Object.entries(probe).filter(([key]) => !["membershipId", "displayName", "characterIds"].includes(key))) as Omit<MembershipProbe, "membershipId" | "displayName" | "characterIds">;
}

export function oauthRefreshRequiredDiagnosis(): { code: string; summary: string; nextSteps: string[] } {
  return {
    code: "OAUTH_REFRESH_REQUIRED",
    summary: "The Bungie access token expired, but Guardian Nexus still has an unexpired refresh session. Read-only diagnostics did not test whether that refresh succeeds.",
    nextSteps: [
      "Return to Guardian Nexus and reload once so the normal application can refresh Bungie authorization.",
      "If the application still cannot load the account, sign out, reconnect Bungie authorization, and run diagnostics again."
    ]
  };
}

export async function probeDestinyMemberships(memberships: any, getProfile: (membershipType: number, membershipId: string) => Promise<any>): Promise<MembershipProbe[]> {
  const entries = Array.isArray(memberships?.destinyMemberships) ? memberships.destinyMemberships : [];
  return Promise.all(entries.map(async (entry: any) => {
    const membershipType = Number(entry?.membershipType || 0);
    const membershipId = String(entry?.membershipId || "");
    const base = {
      membershipType,
      membershipId,
      displayName: String(entry?.displayName || ""),
      crossSaveOverride: Number(entry?.crossSaveOverride || 0),
      applicableMembershipTypes: Array.isArray(entry?.applicableMembershipTypes) ? entry.applicableMembershipTypes.map(Number) : [],
      ...(typeof entry?.isPublic === "boolean" ? { isPublic: entry.isPublic } : {}),
      isPrimary: membershipId === String(memberships?.primaryMembershipId || "")
    };
    try {
      const profile = await getProfile(membershipType, membershipId);
      const characters = profile?.characters?.data && typeof profile.characters.data === "object" ? profile.characters.data : {};
      const characterIds = Object.keys(characters);
      const profileData = profile?.profile?.data;
      const dates = Object.values(characters).map((character: any) => String(character?.dateLastPlayed || "")).filter(Boolean).sort();
      return { ...base, succeeded: true, httpStatus: 200, profileExists: Boolean(profileData), charactersExist: Boolean(profile?.characters?.data), characterCount: characterIds.length, characterIds, ...(dates.at(-1) ? { dateLastPlayed: dates.at(-1) } : {}), usable: Boolean(profileData && characterIds.length) };
    } catch (error: any) {
      return {
        ...base,
        succeeded: false,
        ...(Number.isFinite(Number(error?.httpStatus)) ? { httpStatus: Number(error.httpStatus) } : {}),
        ...(Number.isFinite(Number(error?.bungieErrorCode)) ? { bungieErrorCode: Number(error.bungieErrorCode) } : {}),
        ...(error?.bungieErrorStatus ? { bungieErrorStatus: String(error.bungieErrorStatus) } : {}),
        ...(error?.bungieMessage || error?.message ? { bungieMessage: String(error.bungieMessage || error.message) } : {}),
        ...(Number(error?.throttleSeconds) ? { throttleSeconds: Number(error.throttleSeconds) } : {}),
        profileExists: false,
        charactersExist: false,
        characterCount: 0,
        characterIds: [],
        usable: false
      };
    }
  }));
}

export function selectBestMembership(memberships: any, probes: MembershipProbe[]): MembershipProbe | undefined {
  const primaryId = String(memberships?.primaryMembershipId || "");
  return [...probes].sort((left, right) => membershipScore(right, primaryId) - membershipScore(left, primaryId))[0];
}

function membershipScore(probe: MembershipProbe, primaryId: string): number {
  return (probe.usable ? 10_000 : probe.profileExists ? 5_000 : 0)
    + (probe.membershipId === primaryId ? 500 : 0)
    + (probe.crossSaveOverride === probe.membershipType ? 250 : 0)
    + (probe.applicableMembershipTypes.includes(probe.membershipType) ? 50 : 0)
    + Math.min(10, probe.characterCount);
}

export function membershipDiagnosis(membershipsSucceeded: boolean, probes: MembershipProbe[], selected?: MembershipProbe, storedMembershipId?: string): { code: string; summary: string; nextSteps: string[] } {
  if (!membershipsSucceeded) return { code: "BUNGIE_AUTH_FAILED", summary: "Guardian Nexus could not authenticate the Bungie.net identity or load its membership data.", nextSteps: ["Sign out and reconnect Bungie authorization.", "If Bungie is in maintenance, retry after service is restored."] };
  if (!probes.length) return { code: "NO_DESTINY_MEMBERSHIPS", summary: "Bungie login succeeded, but Bungie returned no linked Destiny memberships.", nextSteps: ["Confirm the intended platform account is linked on Bungie.net.", "Launch Destiny 2 and complete initial profile setup, then reconnect Guardian Nexus."] };
  const usable = probes.filter((probe) => probe.usable);
  const everyNotFound = probes.every((probe) => probe.bungieErrorCode === 1601 || probe.bungieErrorStatus === "DestinyAccountNotFound");
  if (everyNotFound) return { code: "DESTINY_PROFILE_NOT_INITIALIZED", summary: "Bungie recognizes linked platform memberships, but none currently expose a usable Destiny 2 profile (DestinyAccountNotFound / 1601).", nextSteps: ["Launch Destiny 2 on the intended linked platform and create or load a character.", "If the account was recovered recently, confirm platform and Cross Save links on Bungie.net, then allow Bungie time to reconcile them."] };
  if (usable.length && selected && !selected.usable) return { code: "WRONG_DESTINY_MEMBERSHIP", summary: "Guardian Nexus selected a linked membership without a usable Destiny 2 profile, but another linked membership is usable.", nextSteps: ["Reconnect Guardian Nexus so the corrected membership selection can be saved.", "Confirm the intended Cross Save active account on Bungie.net."] };
  if (usable.length && storedMembershipId && !usable.some((probe) => probe.membershipId === storedMembershipId)) return { code: "STALE_MEMBERSHIP_MAPPING", summary: "The saved Guardian Nexus membership no longer matches Bungie's current usable Destiny profile, possibly following account recovery or a Cross Save change.", nextSteps: ["Sign out of Guardian Nexus and reconnect Bungie authorization to refresh the stored membership mapping."] };
  if (probes.some((probe) => probe.profileExists && probe.characterCount === 0)) return { code: "PROFILE_WITHOUT_CHARACTERS", summary: "Bungie returned a Destiny 2 profile, but it currently has no usable characters.", nextSteps: ["Launch Destiny 2 and finish creating or restoring a character, then run diagnostics again."] };
  if (usable.length) return { code: "BUNGIE_PROFILE_VALID", summary: "Bungie authentication, Destiny profile retrieval, and character loading succeeded. Any remaining failure is later in Guardian Nexus's bootstrap pipeline.", nextSteps: ["Review the application bootstrap stages below for the first failure."] };
  return { code: "BUNGIE_PROFILE_UNAVAILABLE", summary: "Bungie returned memberships, but Guardian Nexus could not confirm a usable Destiny 2 profile.", nextSteps: ["Review each membership probe and Bungie error below, then retry outside maintenance or throttling windows."] };
}
