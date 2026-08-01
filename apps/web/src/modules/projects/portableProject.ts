import type { GuardianProject, GuardianProjectItemState, GuardianProjectKind, PortableGuardianProjectEnvelope } from "@guardian-nexus/contracts";

export const PORTABLE_PROJECT_LIMIT = 512_000;

export function portableProject(project: GuardianProject, includeAssignees = false): PortableGuardianProjectEnvelope {
  return {
    kind: "guardian-nexus-project", schemaVersion: 1, exportedAt: new Date().toISOString(),
    project: {
      kind: project.kind, title: project.title, activity: project.activity, scheduledAt: project.scheduledAt, note: project.note, sourceUrl: project.sourceUrl,
      items: project.items.map((item) => ({ label: item.label, state: item.state, assignee: includeAssignees ? item.assignee : undefined }))
    }
  };
}

export function projectBrief(project: GuardianProject, includeAssignees = true) {
  const lines = [`# ${project.title}`, project.activity ? `Activity: ${project.activity}` : "", project.scheduledAt ? `When: ${new Date(project.scheduledAt).toLocaleString()}` : "", ""];
  for (const item of project.items) lines.push(`- [${item.state === "done" ? "x" : " "}] ${item.label}${includeAssignees && item.assignee ? ` — ${item.assignee}` : ""}${item.state === "skipped" ? " (skipped)" : ""}`);
  if (project.note) lines.push("", project.note);
  if (project.sourceUrl) lines.push("", `Reference: ${project.sourceUrl}`);
  return lines.filter((line, index) => line || (index > 0 && lines[index - 1])).join("\n").trim();
}

export function importPortableProject(text: string, now = new Date()): GuardianProject {
  if (new TextEncoder().encode(text).byteLength > PORTABLE_PROJECT_LIMIT) throw new Error("Project file is larger than 512 KB.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("Project file is not valid JSON."); }
  if (!value || typeof value !== "object") throw new Error("Project file has no envelope.");
  const envelope = value as Record<string, unknown>;
  if (envelope.kind !== "guardian-nexus-project" || envelope.schemaVersion !== 1 || !envelope.project || typeof envelope.project !== "object") throw new Error("Project file uses an unsupported format or version.");
  const input = envelope.project as Record<string, unknown>;
  const title = clean(input.title, 80);
  if (!title) throw new Error("Project file has no title.");
  const kind: GuardianProjectKind = input.kind === "clan" || input.kind === "collection" ? input.kind : "activity";
  const timestamp = now.toISOString();
  const items = Array.isArray(input.items) ? input.items.slice(0, 24).flatMap((row, index) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>; const label = clean(item.label, 100); if (!label) return [];
    const state: GuardianProjectItemState = item.state === "done" || item.state === "skipped" ? item.state : "todo";
    return [{ id: `import-item-${now.getTime()}-${index}`, label, state, assignee: clean(item.assignee, 60) || undefined }];
  }) : [];
  return {
    id: `import-project-${now.getTime()}`, kind, title, activity: clean(input.activity, 80) || undefined,
    scheduledAt: date(input.scheduledAt), note: clean(input.note, 600) || undefined, sourceUrl: url(input.sourceUrl), items, createdAt: timestamp, updatedAt: timestamp
  };
}

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function date(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined; }
function url(value: unknown) { const candidate = clean(value, 500); if (!candidate) return undefined; try { const parsed = new URL(candidate); return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined; } catch { return undefined; } }
