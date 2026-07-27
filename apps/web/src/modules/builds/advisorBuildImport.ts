import type { BuildDocument } from "@guardian-nexus/contracts";
import { prepareBuildDocument } from "./builds";

const IMPORT_PREFIX = "guardian-nexus:advisor-build-import:";
const MAX_IMPORT_AGE_MS = 60 * 60_000;

export interface AdvisorBuildImport {
  version: 1;
  sourceName: string;
  createdAt: string;
  document: BuildDocument;
}

export function storeAdvisorBuildImport(
  value: Omit<AdvisorBuildImport, "version" | "createdAt">,
  storage: Storage = window.sessionStorage
): string {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record: AdvisorBuildImport = {
    version: 1,
    sourceName: value.sourceName,
    createdAt: new Date().toISOString(),
    document: prepareBuildDocument({ ...value.document, status: "draft", visibility: "private" })
  };
  storage.setItem(`${IMPORT_PREFIX}${token}`, JSON.stringify(record));
  return token;
}

export function readAdvisorBuildImport(token: string, storage: Storage = window.sessionStorage): AdvisorBuildImport | undefined {
  if (!token) return undefined;
  try {
    const value = JSON.parse(storage.getItem(`${IMPORT_PREFIX}${token}`) || "null") as AdvisorBuildImport | null;
    const age = value?.createdAt ? Date.now() - Date.parse(value.createdAt) : Number.POSITIVE_INFINITY;
    return value?.version === 1 && value.document?.status === "draft" && age >= 0 && age <= MAX_IMPORT_AGE_MS ? value : undefined;
  } catch {
    return undefined;
  }
}

export function removeAdvisorBuildImport(token: string, storage: Storage = window.sessionStorage): void {
  if (token) storage.removeItem(`${IMPORT_PREFIX}${token}`);
}
