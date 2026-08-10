import { describe, expect, it } from "vitest";
import { membershipDiagnosis, oauthRefreshRequiredDiagnosis, probeDestinyMemberships, sanitizedMembershipProbe, selectBestMembership } from "./supportDiagnostics";

describe("support diagnostics membership selection", () => {
  it("prefers a verified usable profile over a broken primary membership", async () => {
    const memberships = { primaryMembershipId: "xbox", destinyMemberships: [
      { membershipType: 1, membershipId: "xbox", displayName: "Xbox", crossSaveOverride: 0 },
      { membershipType: 3, membershipId: "steam", displayName: "Steam", crossSaveOverride: 3, applicableMembershipTypes: [1, 3] }
    ] };
    const probes = await probeDestinyMemberships(memberships, async (_type, id) => {
      if (id === "xbox") throw Object.assign(new Error("Not found"), { httpStatus: 200, bungieErrorCode: 1601, bungieErrorStatus: "DestinyAccountNotFound" });
      return { profile: { data: { userInfo: {} } }, characters: { data: { c1: { dateLastPlayed: "2026-08-01T00:00:00Z" } } } };
    });
    expect(selectBestMembership(memberships, probes)?.membershipId).toBe("steam");
    expect(membershipDiagnosis(true, probes, probes[0]).code).toBe("WRONG_DESTINY_MEMBERSHIP");
  });

  it("distinguishes linked memberships with only 1601 responses", async () => {
    const memberships = { destinyMemberships: [{ membershipType: 3, membershipId: "new", displayName: "Recovered" }] };
    const probes = await probeDestinyMemberships(memberships, async () => { throw Object.assign(new Error("Missing"), { bungieErrorCode: 1601, bungieErrorStatus: "DestinyAccountNotFound" }); });
    expect(membershipDiagnosis(true, probes).code).toBe("DESTINY_PROFILE_NOT_INITIALIZED");
  });

  it("does not claim authentication failed when an unexpired refresh session was not tested", () => {
    expect(oauthRefreshRequiredDiagnosis()).toMatchObject({
      code: "OAUTH_REFRESH_REQUIRED",
      summary: expect.stringContaining("did not test")
    });
  });

  it("removes account and character identifiers from copied membership probes", async () => {
    const [probe] = await probeDestinyMemberships(
      { primaryMembershipId: "private-membership", destinyMemberships: [{ membershipType: 3, membershipId: "private-membership", displayName: "Private Guardian" }] },
      async () => ({ profile: { data: {} }, characters: { data: { "private-character": {} } } })
    );
    const sanitized = sanitizedMembershipProbe(probe!);

    expect(sanitized).not.toHaveProperty("membershipId");
    expect(sanitized).not.toHaveProperty("displayName");
    expect(sanitized).not.toHaveProperty("characterIds");
    expect(JSON.stringify(sanitized)).not.toMatch(/private-membership|Private Guardian|private-character/);
    expect(sanitized).toMatchObject({ membershipType: 3, characterCount: 1, usable: true });
  });
});
