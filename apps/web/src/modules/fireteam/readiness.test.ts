import { describe, expect, it } from "vitest";
import { emptyReadinessDraft, parseReadinessDraft, readinessSummary } from "./readiness";

describe("Fireteam readiness", () => {
  it("keeps malformed or future drafts private and disabled", () => {
    expect(parseReadinessDraft("bad json")).toEqual(emptyReadinessDraft());
    expect(parseReadinessDraft(JSON.stringify({ schemaVersion: 2, enabled: true })).enabled).toBe(false);
  });

  it("only creates a player-confirmed summary after explicit opt-in and an activity", () => {
    const draft = emptyReadinessDraft();
    expect(readinessSummary(draft, [])).toBeUndefined();
    draft.enabled = true;
    expect(readinessSummary(draft, [])).toBeUndefined();
    draft.activityName = "Grandmaster Nightfall";
    draft.role = "support";
    draft.state = "ready";
    expect(readinessSummary(draft, [], "2026-08-01T20:00:00.000Z")).toMatchObject({ activityName: "Grandmaster Nightfall", role: "support", state: "ready", source: "player-confirmed" });
  });
});
