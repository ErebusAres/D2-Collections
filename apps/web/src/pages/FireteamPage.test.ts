import type { FireteamContact } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { canJoinContact } from "./FireteamPage";

const contact = (onlineState: FireteamContact["onlineState"], inDestiny2: boolean): FireteamContact => ({
  membershipId: "1",
  displayName: "Guardian#0001",
  source: "clan",
  onlineState,
  inDestiny2
});

describe("canJoinContact", () => {
  it("allows an online clan member when Bungie omits the current-title flag", () => {
    expect(canJoinContact(contact("online", false))).toBe(true);
  });

  it("keeps offline and unknown contacts blocked", () => {
    expect(canJoinContact(contact("offline", true))).toBe(false);
    expect(canJoinContact(contact("unknown", false))).toBe(false);
  });
});
