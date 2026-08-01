import type { FireteamReadinessRole, FireteamReadinessState, FireteamReadinessSummary, GuardianBuild } from "@guardian-nexus/contracts";

export interface FireteamReadinessDraft {
  schemaVersion: 1;
  enabled: boolean;
  activityName: string;
  role: FireteamReadinessRole;
  state: FireteamReadinessState;
  buildId: string;
  prerequisites: FireteamReadinessSummary["prerequisites"];
  note: string;
}

export const emptyReadinessDraft = (): FireteamReadinessDraft => ({
  schemaVersion: 1,
  enabled: false,
  activityName: "",
  role: "flex",
  state: "not-checked",
  buildId: "",
  prerequisites: [
    { id: "access", label: "Activity access unlocked", state: "not-checked" },
    { id: "counters", label: "Required counters covered", state: "not-checked" },
    { id: "comms", label: "Comms and callouts ready", state: "not-checked" }
  ],
  note: ""
});

export function parseReadinessDraft(value?: string): FireteamReadinessDraft {
  try {
    const parsed = JSON.parse(value || "null") as Partial<FireteamReadinessDraft> | null;
    if (!parsed || parsed.schemaVersion !== 1) return emptyReadinessDraft();
    const fallback = emptyReadinessDraft();
    const states = new Set<FireteamReadinessState>(["ready", "needs-attention", "not-checked"]);
    const roles = new Set<FireteamReadinessRole>(["damage", "support", "control", "flex"]);
    return {
      ...fallback,
      enabled: parsed.enabled === true,
      activityName: typeof parsed.activityName === "string" ? parsed.activityName.slice(0, 80) : "",
      role: roles.has(parsed.role as FireteamReadinessRole) ? parsed.role as FireteamReadinessRole : "flex",
      state: states.has(parsed.state as FireteamReadinessState) ? parsed.state as FireteamReadinessState : "not-checked",
      buildId: typeof parsed.buildId === "string" ? parsed.buildId.slice(0, 100) : "",
      prerequisites: Array.isArray(parsed.prerequisites) ? parsed.prerequisites.slice(0, 12).flatMap((entry, index) => {
        if (!entry || typeof entry.label !== "string" || !entry.label.trim()) return [];
        return [{ id: typeof entry.id === "string" && entry.id ? entry.id.slice(0, 60) : `check-${index}`, label: entry.label.trim().slice(0, 100), state: states.has(entry.state) ? entry.state : "not-checked" }];
      }) : fallback.prerequisites,
      note: typeof parsed.note === "string" ? parsed.note.slice(0, 240) : ""
    };
  } catch { return emptyReadinessDraft(); }
}

export function readinessSummary(draft: FireteamReadinessDraft, builds: GuardianBuild[], updatedAt = new Date().toISOString()): FireteamReadinessSummary | undefined {
  if (!draft.enabled || !draft.activityName.trim()) return undefined;
  const build = builds.find((entry) => entry.id === draft.buildId);
  return {
    schemaVersion: 1,
    activityName: draft.activityName.trim(),
    role: draft.role,
    state: draft.state,
    build: build ? { id: build.id, title: build.title, subclass: build.subclass } : undefined,
    prerequisites: draft.prerequisites,
    note: draft.note.trim() || undefined,
    source: "player-confirmed",
    updatedAt
  };
}
