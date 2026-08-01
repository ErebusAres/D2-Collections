import { describe, expect, it } from "vitest";
import { challengeScore, challengeToProject, importChallenge, parseChallenges, portableChallenge } from "./challenges";

const challenge = parseChallenges(JSON.stringify({ schemaVersion: 1, challenges: [{ id: "one", title: "Night", mode: "fireteam", createdAt: "2026-08-01T00:00:00Z", tasks: [{ label: "First", points: 2, state: "done" }, { label: "Second", points: 3 }] }] })).challenges[0]!;

describe("community challenges", () => {
  it("scores only actionable player-recorded tasks", () => {
    expect(challengeScore(challenge)).toEqual({ earned: 2, total: 5 });
    challenge.tasks[1]!.state = "skipped";
    expect(challengeScore(challenge)).toEqual({ earned: 2, total: 2 });
  });

  it("imports a fresh account-neutral copy and adapts it to a private project", () => {
    const imported = importChallenge(JSON.stringify(portableChallenge(challenge)), new Date("2026-08-02T00:00:00Z"));
    expect(imported.tasks.every((task) => task.state === "todo")).toBe(true);
    expect(imported.id).not.toBe(challenge.id);
    const project = challengeToProject(imported, new Date("2026-08-02T00:00:00Z"));
    expect(project.kind).toBe("activity");
    expect(project.items[0]!.label).toContain("2 pts");
  });
});
