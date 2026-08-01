import type { CommunityChallenge, CommunityChallengesDocument, CommunityChallengeTask, GuardianProject, PortableCommunityChallengeEnvelope } from "@guardian-nexus/contracts";

export const EMPTY_CHALLENGES: CommunityChallengesDocument = { schemaVersion: 1, challenges: [] };
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const iso = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
const newId = (prefix: string) => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function parseChallenges(value?: string): CommunityChallengesDocument {
  if (!value) return EMPTY_CHALLENGES;
  try {
    const input = JSON.parse(value) as { schemaVersion?: unknown; challenges?: unknown };
    if (input.schemaVersion !== 1 || !Array.isArray(input.challenges)) return EMPTY_CHALLENGES;
    return { schemaVersion: 1, challenges: input.challenges.slice(0, 20).map(normalizeChallenge).filter((entry): entry is CommunityChallenge => Boolean(entry)) };
  } catch { return EMPTY_CHALLENGES; }
}

export function challengeScore(challenge: CommunityChallenge) {
  const available = challenge.tasks.filter((task) => task.state !== "skipped");
  return { earned: available.filter((task) => task.state === "done").reduce((sum, task) => sum + task.points, 0), total: available.reduce((sum, task) => sum + task.points, 0) };
}

export function portableChallenge(challenge: CommunityChallenge): PortableCommunityChallengeEnvelope {
  return { format: "guardian-nexus-community-challenge", version: 1, exportedAt: new Date().toISOString(), challenge: { title: challenge.title, description: challenge.description, mode: challenge.mode, tasks: challenge.tasks.map(({ label, points }) => ({ label, points })) } };
}

export function importChallenge(raw: string, now = new Date()): CommunityChallenge {
  if (new TextEncoder().encode(raw).length > 256_000) throw new Error("Challenge import exceeds the 256 KB limit.");
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new Error("Challenge import is not valid JSON."); }
  const envelope = input as Partial<PortableCommunityChallengeEnvelope>;
  if (!input || typeof input !== "object" || envelope.format !== "guardian-nexus-community-challenge" || envelope.version !== 1) throw new Error("Challenge import uses an unsupported format or version.");
  const timestamp = now.toISOString();
  const challenge = normalizeChallenge({ ...envelope.challenge, id: newId("challenge"), createdAt: timestamp, updatedAt: timestamp });
  if (!challenge) throw new Error("Challenge import does not contain a valid title and checklist.");
  return challenge;
}

export function challengeToProject(challenge: CommunityChallenge, now = new Date()): GuardianProject {
  const timestamp = now.toISOString();
  return {
    id: newId("project"), kind: challenge.mode === "clan" ? "clan" : "activity", title: challenge.title,
    activity: "Community challenge", note: challenge.description, createdAt: timestamp, updatedAt: timestamp,
    items: challenge.tasks.map((task, index) => ({ id: `challenge-task-${now.getTime()}-${index}`, label: `${task.label} (${task.points} pt${task.points === 1 ? "" : "s"})`, state: task.state }))
  };
}

function normalizeChallenge(value: unknown): CommunityChallenge | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const title = clean(row.title, 80);
  const tasks = (Array.isArray(row.tasks) ? row.tasks : []).slice(0, 24).map(normalizeTask).filter((entry): entry is CommunityChallengeTask => Boolean(entry));
  if (!title || !tasks.length) return null;
  const mode = row.mode === "fireteam" || row.mode === "clan" ? row.mode : "solo";
  const createdAt = iso(row.createdAt) || new Date(0).toISOString();
  return { id: clean(row.id, 80) || newId("challenge"), title, description: clean(row.description, 600) || undefined, mode, tasks, createdAt, updatedAt: iso(row.updatedAt) || createdAt, completedAt: iso(row.completedAt) };
}

function normalizeTask(value: unknown, index: number): CommunityChallengeTask | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const label = clean(row.label, 120);
  if (!label) return null;
  const points = Math.max(1, Math.min(100, Number.isFinite(Number(row.points)) ? Math.round(Number(row.points)) : 1));
  const state = row.state === "done" || row.state === "skipped" ? row.state : "todo";
  return { id: clean(row.id, 80) || `task-${index}`, label, points, state };
}
