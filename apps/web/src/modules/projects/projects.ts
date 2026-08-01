import type { GuardianProject, GuardianProjectItem, GuardianProjectKind, GuardianProjectsDocument } from "@guardian-nexus/contracts";

export const EMPTY_PROJECTS: GuardianProjectsDocument = { schemaVersion: 1, projects: [] };
export const PROJECT_KINDS: { kind: GuardianProjectKind; label: string; hint: string }[] = [
  { kind: "activity", label: "Activity plan", hint: "Prepare a raid, dungeon, mission, or PvP session." },
  { kind: "clan", label: "Clan draft", hint: "Coordinate roles and tasks privately before sharing details yourself." },
  { kind: "collection", label: "Collection checklist", hint: "Track a title, pattern, catalyst, fashion set, or other multi-step chase." }
];

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const iso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
const id = (value: unknown, fallback: string) => text(value, 80) || fallback;

export function parseProjects(value?: string): GuardianProjectsDocument {
  if (!value) return EMPTY_PROJECTS;
  try {
    const input = JSON.parse(value) as { schemaVersion?: unknown; projects?: unknown };
    if (input.schemaVersion !== 1 || !Array.isArray(input.projects)) return EMPTY_PROJECTS;
    const projects = input.projects.slice(0, 20).map((entry, projectIndex) => normalizeProject(entry, projectIndex)).filter((entry): entry is GuardianProject => Boolean(entry));
    return { schemaVersion: 1, projects };
  } catch { return EMPTY_PROJECTS; }
}

function normalizeProject(value: unknown, projectIndex: number): GuardianProject | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const kind: GuardianProjectKind = row.kind === "clan" || row.kind === "collection" ? row.kind : "activity";
  const title = text(row.title, 80);
  if (!title) return null;
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = rawItems.slice(0, 24).map((entry, itemIndex) => normalizeItem(entry, projectIndex, itemIndex)).filter((entry): entry is GuardianProjectItem => Boolean(entry));
  const createdAt = iso(row.createdAt) || new Date(0).toISOString();
  return {
    id: id(row.id, `project-${projectIndex}`), kind, title,
    activity: text(row.activity, 80) || undefined,
    scheduledAt: iso(row.scheduledAt), note: text(row.note, 600) || undefined,
    sourceUrl: safeUrl(row.sourceUrl), items, createdAt,
    updatedAt: iso(row.updatedAt) || createdAt, completedAt: iso(row.completedAt)
  };
}

function normalizeItem(value: unknown, projectIndex: number, itemIndex: number): GuardianProjectItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const label = text(row.label, 100);
  if (!label) return null;
  const state = row.state === "done" || row.state === "skipped" ? row.state : "todo";
  return { id: id(row.id, `item-${projectIndex}-${itemIndex}`), label, state, assignee: text(row.assignee, 60) || undefined };
}

function safeUrl(value: unknown): string | undefined {
  const candidate = text(value, 500);
  if (!candidate) return undefined;
  try { const url = new URL(candidate); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined; }
  catch { return undefined; }
}

export function projectProgress(project: GuardianProject) {
  const actionable = project.items.filter((item) => item.state !== "skipped");
  const done = actionable.filter((item) => item.state === "done").length;
  return { done, total: actionable.length, percent: actionable.length ? Math.round((done / actionable.length) * 100) : 0 };
}
