import type { CleanupAnalysis } from "@guardian-nexus/contracts";

/** Object insertion order is not a settings change. */
export function cleanupSettingsKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(cleanupSettingsKey).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${cleanupSettingsKey(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export function updateCleanupCache(value: unknown, marks: CleanupAnalysis["marks"], changed: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((entry) => updateCleanupCache(entry, marks, changed));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const updated = Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, updateCleanupCache(entry, marks, changed)]));
  if (typeof record.instanceId === "string" && changed.has(record.instanceId)) updated.cleanupRecommendation = marks[record.instanceId];
  return updated;
}
