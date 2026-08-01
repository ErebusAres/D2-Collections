import { describe, expect, it } from "vitest";
import { parseProjects, projectProgress } from "./projects";

describe("private projects", () => {
  it("normalizes versioned plans and calculates checklist progress", () => {
    const document = parseProjects(JSON.stringify({ schemaVersion: 1, projects: [{ id: "p1", kind: "collection", title: "  Seal chase  ", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", items: [{ id: "a", label: "First", state: "done" }, { id: "b", label: "Second", state: "todo" }, { id: "c", label: "Skip", state: "skipped" }] }] }));
    expect(document.projects[0]?.title).toBe("Seal chase");
    expect(projectProgress(document.projects[0]!)).toEqual({ done: 1, total: 2, percent: 50 });
  });

  it("fails closed for unsupported documents and unsafe links", () => {
    expect(parseProjects('{"schemaVersion":2,"projects":[]}')).toEqual({ schemaVersion: 1, projects: [] });
    const document = parseProjects(JSON.stringify({ schemaVersion: 1, projects: [{ title: "Plan", sourceUrl: "javascript:alert(1)", items: [] }] }));
    expect(document.projects[0]?.sourceUrl).toBeUndefined();
  });
});
