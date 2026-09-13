import type { ConnectionFailure } from "./client";

function readDiagnostic(key: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : undefined;
  } catch { return undefined; }
}

export const getClientReliabilityDiagnostics = () => getLastServiceIncident()?.code === "worker_resource_limit" ? getLastServiceIncident() : readDiagnostic("guardian-nexus:last-worker-resource-limit");
export const getLastApiErrorDiagnostics = () => getLastServiceIncident() || readDiagnostic("guardian-nexus:last-api-error");

export function getLastServiceIncident(): ConnectionFailure | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem("guardian-nexus:last-service-incident") || "null");
    return value && typeof value.code === "string" && typeof value.route === "string" && typeof value.occurredAt === "string" ? value : undefined;
  } catch { return undefined; }
}

export function connectionFailureReport(failure: ConnectionFailure): string {
  const diagnostics = failure.diagnostics || {};
  const page = typeof location !== "undefined" ? location.pathname : "unknown";
  const visibility = typeof document !== "undefined" ? document.visibilityState : "unknown";
  const online = typeof navigator !== "undefined" ? navigator.onLine : undefined;
  const browser = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  return [
    "Guardian Nexus service incident",
    `Time: ${failure.occurredAt}`,
    `Route: ${failure.route}`,
    `Message: ${failure.message}`,
    `Error code: ${failure.code}`,
    failure.status ? `HTTP status: ${failure.status}` : "HTTP status: no response",
    failure.requestId ? `Reference: ${failure.requestId}` : undefined,
    failure.retryAfterSeconds ? `Retry after: ${failure.retryAfterSeconds}s` : undefined,
    `Failure source: ${String(diagnostics.failureSource || "unknown")}`,
    diagnostics.method ? `Method: ${String(diagnostics.method)}` : undefined,
    diagnostics.durationMs !== undefined ? `Duration: ${String(diagnostics.durationMs)}ms` : undefined,
    diagnostics.cfRay ? `Cloudflare Ray: ${String(diagnostics.cfRay)}` : undefined,
    diagnostics.responseContentType ? `Response type: ${String(diagnostics.responseContentType)}` : undefined,
    diagnostics.responseServer ? `Response server: ${String(diagnostics.responseServer)}` : undefined,
    `Page: ${page}`,
    `Tab visibility: ${visibility}`,
    online === undefined ? undefined : `Browser online: ${online ? "yes" : "no"}`,
    `Frontend commit: ${import.meta.env.VITE_GIT_COMMIT || "unknown"}`,
    `Frontend built: ${import.meta.env.VITE_BUILD_TIMESTAMP || "unknown"}`,
    `Browser: ${browser}`,
    failure.recentRequests?.length ? "Recent API requests:" : undefined,
    ...(failure.recentRequests || []).map((trace) => `- ${trace.occurredAt} ${trace.method} ${trace.route} -> ${trace.status}${trace.code ? ` ${trace.code}` : ""} (${trace.durationMs}ms)${trace.requestId ? ` [${trace.requestId}]` : ""}`)
  ].filter(Boolean).join("\n");
}
