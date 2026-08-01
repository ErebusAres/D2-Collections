import type { BuildDocument, GuardianBuild, PortableBuildEnvelope } from "@guardian-nexus/contracts";
import { emptyBuildDocument, prepareBuildDocument } from "./builds";

export function exportPortableBuild(build: GuardianBuild, exportedAt = new Date().toISOString()): PortableBuildEnvelope {
  const document = { ...build } as Partial<GuardianBuild>;
  for (const key of ["id", "slug", "authorMembershipId", "authorDisplayName", "rating", "viewerVote", "canEdit", "createdAt", "updatedAt", "publishedAt"] as const) delete document[key];
  return {
    schemaVersion: 1,
    kind: "guardian-nexus-build",
    exportedAt,
    source: "guardian-nexus",
    document: prepareBuildDocument({ ...document, status: "draft", visibility: "private" } as BuildDocument)
  };
}

export function parsePortableBuild(text: string): BuildDocument {
  if (text.length > 1_000_000) throw new Error("Build file is larger than 1 MB.");
  let envelope: unknown;
  try { envelope = JSON.parse(text); } catch { throw new Error("Build file is not valid JSON."); }
  if (!isRecord(envelope) || envelope.schemaVersion !== 1 || envelope.kind !== "guardian-nexus-build" || !isRecord(envelope.document)) {
    throw new Error("This is not a supported Guardian Nexus build export.");
  }
  const value = envelope.document;
  if (typeof value.title !== "string" || !["hunter", "titan", "warlock"].includes(String(value.classType)) || !["prismatic", "arc", "solar", "void", "strand", "stasis"].includes(String(value.subclass))) {
    throw new Error("The exported build is missing its title, class, or subclass.");
  }
  const fallback = emptyBuildDocument();
  return prepareBuildDocument({
    ...fallback,
    ...value,
    subclassConfig: { ...fallback.subclassConfig, ...(isRecord(value.subclassConfig) ? value.subclassConfig : {}) },
    equipment: { ...fallback.equipment, ...(isRecord(value.equipment) ? value.equipment : {}) },
    armorMods: { ...fallback.armorMods, ...(isRecord(value.armorMods) ? value.armorMods : {}) },
    cosmetics: { ...fallback.cosmetics, ...(isRecord(value.cosmetics) ? value.cosmetics : {}) },
    status: "draft",
    visibility: "private"
  } as BuildDocument);
}

export function portableBuildFilename(title: string): string {
  const stem = title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "guardian-build";
  return `${stem}.guardian-nexus.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
