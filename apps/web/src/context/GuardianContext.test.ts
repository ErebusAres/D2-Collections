import type { ApiEnvelope, SessionData } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { safeSessionForCache } from "./GuardianContext";

describe("safe Guardian session cache", () => {
  it("retains server-verified role flags while marking them stale", () => {
    const envelope = {
      data: {
        authenticated: true,
        csrfToken: "private-token",
        roles: { dev: true, matrixWriter: true, buildEditor: true, reportAdmin: true },
        rolesState: "verified"
      },
      freshness: { state: "fresh", observedAt: "2026-08-05T12:00:00.000Z" },
      warnings: [],
      requestId: "session"
    } satisfies ApiEnvelope<SessionData>;

    const cached = safeSessionForCache(envelope);

    expect(cached.data.roles).toEqual(envelope.data.roles);
    expect(cached.data.rolesState).toBe("stale");
    expect(cached.data.csrfToken).toBeUndefined();
    expect(cached.freshness.state).toBe("stale");
  });
});
