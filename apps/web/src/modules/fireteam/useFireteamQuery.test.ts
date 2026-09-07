import type { FireteamData } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import {
  FIRETEAM_COMMIT_CHECK_INTERVAL_MS,
  FIRETEAM_POLL_INTERVAL_MS,
  fireteamPollInterval
} from "./useFireteamQuery";

describe("Fireteam query polling", () => {
  it("keeps polling disabled when global refresh or sharing is off", () => {
    expect(fireteamPollInterval(false, response("current", true))).toBe(false);
    expect(fireteamPollInterval(true, response("current", false))).toBe(false);
    expect(fireteamPollInterval(true)).toBe(false);
  });

  it("uses bounded reads until the backend starts a refresh", () => {
    expect(fireteamPollInterval(true, response("current", true))).toBe(FIRETEAM_POLL_INTERVAL_MS);
    expect(fireteamPollInterval(true, response("waiting", true))).toBe(FIRETEAM_POLL_INTERVAL_MS);
    expect(fireteamPollInterval(true, response("delayed", true))).toBe(FIRETEAM_POLL_INTERVAL_MS);
  });

  it("checks quickly for the commit after a due read starts backend work", () => {
    expect(fireteamPollInterval(true, response("refreshing", true))).toBe(FIRETEAM_COMMIT_CHECK_INTERVAL_MS);
  });
});

function response(refreshState: FireteamData["refreshState"], sharingEnabled: boolean) {
  return {
    data: {
      sharingEnabled,
      sharingMode: sharingEnabled ? "persistent" as const : "off" as const,
      refreshState,
      members: []
    }
  };
}
