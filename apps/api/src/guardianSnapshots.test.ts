import { describe, expect, it } from "vitest";
import { guardianSnapshotSchema } from "./guardianSnapshots";

describe("Guardian snapshot validation", () => {
  it("accepts only explicit player-curated, private or unlisted fields", () => {
    const parsed = guardianSnapshotSchema.parse({ schemaVersion: 1, title: "Raid night", visibility: "unlisted", guardian: { className: "Warlock", guardianRank: 8 }, goals: ["Teach the encounter"], tags: ["patient"], source: "player-curated" });
    expect(parsed).toMatchObject({ visibility: "unlisted", guardian: { className: "Warlock" } });
    expect(parsed).not.toHaveProperty("membershipId");
  });

  it("rejects ownership, inventory, and unknown account fields", () => {
    expect(() => guardianSnapshotSchema.parse({ schemaVersion: 1, title: "Unsafe", visibility: "unlisted", goals: [], tags: [], source: "player-curated", inventory: [{ hash: "1" }] })).toThrow();
    expect(() => guardianSnapshotSchema.parse({ schemaVersion: 1, title: "Public", visibility: "public", goals: [], tags: [], source: "player-curated" })).toThrow();
    expect(() => guardianSnapshotSchema.parse({ schemaVersion: 1, title: "Unsafe link", visibility: "private", selectedBuild: { title: "Bad", url: "javascript:alert(1)" }, goals: [], tags: [], source: "player-curated" })).toThrow();
  });
});
