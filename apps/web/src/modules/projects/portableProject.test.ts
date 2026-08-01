import type { GuardianProject } from "@guardian-nexus/contracts";
import { describe, expect, it } from "vitest";
import { importPortableProject, portableProject, projectBrief } from "./portableProject";

const project: GuardianProject = { id: "private-id", kind: "clan", title: "Raid night", activity: "Test Raid", items: [{ id: "member-id", label: "Bring champion counter", state: "todo", assignee: "Alex" }], createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z", completedAt: "2026-08-01T01:00:00Z" };

describe("portable Guardian projects", () => {
  it("exports account-neutral JSON and makes assignee sharing explicit", () => {
    const safe = portableProject(project);
    expect(JSON.stringify(safe)).not.toContain("private-id");
    expect(safe.project.items[0]?.assignee).toBeUndefined();
    expect(portableProject(project, true).project.items[0]?.assignee).toBe("Alex");
    expect(projectBrief(project)).toContain("Bring champion counter — Alex");
  });
  it("imports as a new active private project and rejects unsafe envelopes", () => {
    const imported = importPortableProject(JSON.stringify(portableProject(project, true)), new Date("2026-08-02T00:00:00Z"));
    expect(imported).toMatchObject({ title: "Raid night", createdAt: "2026-08-02T00:00:00.000Z" });
    expect(imported.completedAt).toBeUndefined();
    expect(imported.id).not.toBe(project.id);
    expect(() => importPortableProject('{"kind":"other","schemaVersion":1}')).toThrow(/unsupported/i);
  });
});
