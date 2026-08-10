import type { ApiEnvelope, ApiError } from "@guardian-nexus/contracts";
import { readApiResponse, readMutations, removeMutation, setOfflineCacheMembership, storeApiResponse, storeMutation, updateMutation, type PersistedMutation } from "./offlineCache";

export class ApiRequestError extends Error {
  status: number;
  code: string;
  retryAfterSeconds?: number;
  requestId?: string;

  constructor(status: number, body: Partial<ApiError>) {
    super(body.message || "Guardian Nexus request failed.");
    this.status = status;
    this.code = body.code || "request_failed";
    this.retryAfterSeconds = body.retryAfterSeconds;
    this.requestId = body.requestId;
  }
}

interface ConnectionSnapshot {
  queued: number;
  retrying: boolean;
  lastError?: string;
  usingSavedData?: boolean;
  lastSavedAt?: string;
  lastSyncAt?: string;
}

interface PendingMutation {
  path: string;
  init: RequestInit;
  resolve: (value: ApiEnvelope<unknown>) => void;
  reject: (reason: unknown) => void;
  attempts: number;
  persisted?: PersistedMutation;
}

interface QueueOptions { persist?: boolean }
const RELIABILITY_DIAGNOSTIC_KEY = "guardian-nexus:last-worker-resource-limit";

let connectionSnapshot: ConnectionSnapshot = { queued: 0, retrying: false, ...(typeof navigator !== "undefined" && !navigator.onLine ? { lastError: "Device is offline" } : {}) };
const connectionListeners = new Set<() => void>();
const pendingMutations: PendingMutation[] = [];
let flushTimer: number | undefined;
let flushing = false;
const inFlightReads = new Map<string, Promise<ApiEnvelope<unknown>>>();
const savedReadPaths = new Map<string, string>();
const savedReadFailures = new Map<string, number>();
const routeCircuitBreakers = new Map<string, number>();
const SAVED_READ_WARNING_TTL_MS = 2 * 60_000;
let mutationAuthHeaders: (() => HeadersInit) | undefined;
let hydratedMutationScope = "";
let activeMembershipId = "";

export function configureOfflineApi(membershipId: string | undefined, authHeaders: () => HeadersInit): void {
  const nextMembershipId = membershipId || "";
  if (activeMembershipId && activeMembershipId !== nextMembershipId) {
    const abandoned = pendingMutations.splice(0);
    abandoned.forEach((pending) => pending.reject(new Error("The selected Guardian changed before this request could be retried.")));
    updateConnection({ queued: 0, retrying: false });
    savedReadPaths.clear();
    savedReadFailures.clear();
  }
  activeMembershipId = nextMembershipId;
  setOfflineCacheMembership(membershipId);
  mutationAuthHeaders = authHeaders;
  if (!membershipId) { hydratedMutationScope = ""; return; }
  if (hydratedMutationScope === membershipId) return;
  hydratedMutationScope = membershipId;
  void hydratePersistedMutations();
}

export function api<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const method = String(init.method || "GET").toUpperCase();
  if (method !== "GET" || init.body) return performRequest<T>(path, init);
  const existing = inFlightReads.get(path);
  if (existing) return existing as Promise<ApiEnvelope<T>>;
  const request = performReadRequest<T>(path, init);
  inFlightReads.set(path, request as Promise<ApiEnvelope<unknown>>);
  void request.finally(() => { if (inFlightReads.get(path) === request) inFlightReads.delete(path); }).catch(() => undefined);
  return request;
}

async function performReadRequest<T>(path: string, init: RequestInit): Promise<ApiEnvelope<T>> {
  try {
    const envelope = await performRequest<T>(path, init);
    clearSavedReadRoute(path);
    updateSavedDataConnection({ lastSyncAt: new Date().toISOString() });
    void storeApiResponse(path, envelope).catch(() => undefined);
    return envelope;
  } catch (error) {
    if (!isTransient(error)) throw error;
    const cached = await readApiResponse<T>(path).catch(() => undefined);
    if (!cached) throw error;
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(cached.savedAt)) / 1_000));
    savedReadPaths.set(path, cached.savedAt);
    savedReadFailures.set(path, Date.now());
    const savedEnvelope = ageSavedFireteamPresence(path, cached.envelope, ageSeconds);
    updateSavedDataConnection({ lastError: sectionFailureMessage(path, error) });
    const savedWarning = isIndependentFireteamSection(path)
      ? `${sectionFailureMessage(path, error)} Showing saved data from ${new Date(cached.savedAt).toLocaleString()}.`
      : `Showing saved Guardian data from ${new Date(cached.savedAt).toLocaleString()} while live services reconnect.`;
    return {
      ...savedEnvelope,
      freshness: { ...savedEnvelope.freshness, state: offline ? "offline" : "stale", ageSeconds },
      warnings: [...savedEnvelope.warnings.filter((warning) => !warning.startsWith("Showing saved Guardian data")), savedWarning]
    };
  }
}

async function performRequest<T>(path: string, init: RequestInit): Promise<ApiEnvelope<T>> {
  const route = path.split("?", 1)[0] || path;
  const blockedUntil = routeCircuitBreakers.get(route) || 0;
  if (blockedUntil > Date.now()) throw new ApiRequestError(503, { code: "worker_resource_limit", message: sectionFailureMessage(path) });
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "include",
      ...init,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers }
    });
  } catch (error) {
    updateConnection({ lastError: messageOf(error) });
    throw error;
  }
  const raw = await response.text();
  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch {
    if (!response.ok && /1102|exceeded resource limits/i.test(raw)) {
      const rayId = response.headers.get("cf-ray")?.split("-")[0] || raw.match(/Cloudflare Ray ID:\s*<strong[^>]*>([^<]+)/i)?.[1]?.trim();
      body = { code: "worker_resource_limit", message: sectionFailureMessage(path), requestId: rayId };
    }
  }
  if (!response.ok) {
    const error = new ApiRequestError(response.status, body);
    if (error.code === "worker_resource_limit") {
      routeCircuitBreakers.set(route, Date.now() + 60_000 + Math.round(Math.random() * 10_000));
      rememberWorkerResourceLimit(route, error.requestId);
    }
    if (isTransient(error) && error.code !== "worker_resource_limit") updateConnection({ lastError: error.message });
    throw error;
  }
  if (!pendingMutations.length && !savedReadPaths.size) updateConnection({ lastError: undefined });
  return body as ApiEnvelope<T>;
}

export async function queuedApi<T>(path: string, init: RequestInit, options: QueueOptions = {}): Promise<ApiEnvelope<T>> {
  const persisted = options.persist ? await storeMutation({ path, method: String(init.method || "PUT").toUpperCase(), body: typeof init.body === "string" ? init.body : undefined }).catch(() => undefined) : undefined;
  try {
    const result = await api<T>(path, init);
    if (persisted) void removeMutation(persisted.id).catch(() => undefined);
    return result;
  } catch (error) {
    if (!isTransient(error)) {
      if (persisted) await removeMutation(persisted.id).catch(() => undefined);
      throw error;
    }
    return new Promise<ApiEnvelope<T>>((resolve, reject) => {
      pendingMutations.push({ path, init, resolve: resolve as (value: ApiEnvelope<unknown>) => void, reject, attempts: 0, persisted });
      updateConnection({ queued: pendingMutations.length, lastError: messageOf(error) });
      scheduleFlush(2_000);
    });
  }
}

export function subscribeConnection(listener: () => void): () => void {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

export function getConnectionSnapshot(): ConnectionSnapshot { return connectionSnapshot; }

function isTransient(error: unknown): boolean {
  return !(error instanceof ApiRequestError) || error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
}

function messageOf(error: unknown): string { return error instanceof Error ? error.message : "Connection interrupted"; }

function sectionFailureMessage(path: string, error?: unknown): string {
  const pathname = path.split("?", 1)[0] || path;
  const delayed = (!error || (error instanceof ApiRequestError && error.code === "worker_resource_limit")) ? " delayed" : " unavailable";
  if (pathname === "/api/v1/fireteam") return `Fireteam live presence${delayed}—showing saved data.`;
  if (pathname === "/api/v1/fireteam/social") return `Fireteam Social${delayed}—showing saved data.`;
  if (pathname === "/api/v1/fireteam/activity") return `Fireteam Activity${delayed}—showing saved data.`;
  if (pathname === "/api/v1/me/recent-items") return `Recent items${delayed}—showing saved data.`;
  return error ? messageOf(error) : "Guardian services are temporarily over capacity.";
}

function isIndependentFireteamSection(path: string): boolean {
  const pathname = path.split("?", 1)[0] || path;
  return pathname === "/api/v1/fireteam" || pathname === "/api/v1/fireteam/social" || pathname === "/api/v1/fireteam/activity" || pathname === "/api/v1/me/recent-items";
}

function rememberWorkerResourceLimit(route: string, rayId?: string): void {
  if (typeof sessionStorage === "undefined") return;
  try { sessionStorage.setItem(RELIABILITY_DIAGNOSTIC_KEY, JSON.stringify({ category: "worker_resource_limit", route, occurredAt: new Date().toISOString(), rayId })); } catch { /* Diagnostics are best-effort only. */ }
}

export function getClientReliabilityDiagnostics(): Record<string, unknown> | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  try {
    const value = JSON.parse(sessionStorage.getItem(RELIABILITY_DIAGNOSTIC_KEY) || "null");
    return value && typeof value === "object" ? value : undefined;
  } catch { return undefined; }
}

function ageSavedFireteamPresence<T>(path: string, envelope: ApiEnvelope<T>, ageSeconds: number): ApiEnvelope<T> {
  if ((path.split("?", 1)[0] || path) !== "/api/v1/fireteam" || ageSeconds <= 120) return envelope;
  const data = envelope.data as any;
  if (!data || !Array.isArray(data.members)) return envelope;
  return { ...envelope, data: { ...data, members: data.members.map((member: any) => ({ ...member, onlineState: "unknown", presenceLabel: "Presence unknown", activity: undefined, activitySource: "unavailable" })) } };
}

function updateConnection(value: Partial<ConnectionSnapshot>): void {
  connectionSnapshot = { ...connectionSnapshot, ...value };
  connectionListeners.forEach((listener) => listener());
}

function scheduleFlush(delay: number): void {
  if (typeof window === "undefined" || flushTimer !== undefined) return;
  flushTimer = window.setTimeout(() => { flushTimer = undefined; void flushPending(); }, delay);
}

async function flushPending(): Promise<void> {
  if (flushing || !pendingMutations.length || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  flushing = true;
  updateConnection({ retrying: true });
  while (pendingMutations.length) {
    const pending = pendingMutations[0];
    if (!pending) break;
    try {
      const init = pending.persisted ? replayInit(pending.persisted) : pending.init;
      const result = await api<unknown>(pending.path, init);
      pendingMutations.shift();
      if (pending.persisted) await removeMutation(pending.persisted.id).catch(() => undefined);
      pending.resolve(result);
      updateConnection({ queued: pendingMutations.length, lastError: undefined });
    } catch (error) {
      if (!isTransient(error)) {
        pendingMutations.shift();
        if (pending.persisted) await removeMutation(pending.persisted.id).catch(() => undefined);
        pending.reject(error);
        updateConnection({ queued: pendingMutations.length, lastError: messageOf(error) });
        continue;
      }
      pending.attempts += 1;
      if (pending.persisted) {
        pending.persisted.attempts = pending.attempts;
        await updateMutation(pending.persisted).catch(() => undefined);
      }
      updateConnection({ lastError: messageOf(error) });
      scheduleFlush(Math.min(60_000, 2_000 * 2 ** Math.min(5, pending.attempts)));
      break;
    }
  }
  flushing = false;
  updateConnection({ retrying: false });
}

function updateSavedDataConnection(value: Partial<ConnectionSnapshot>): void {
  for (const [path, failedAt] of savedReadFailures) {
    if (savedReadFailureIsCurrent(failedAt)) continue;
    savedReadFailures.delete(path);
    savedReadPaths.delete(path);
  }
  const savedAt = [...savedReadPaths.values()].sort()[0];
  updateConnection({ ...value, usingSavedData: savedReadPaths.size > 0, lastSavedAt: savedAt, ...(!savedReadPaths.size ? { lastError: undefined } : {}) });
}

function clearSavedReadRoute(path: string): void {
  const route = path.split("?", 1)[0] || path;
  for (const savedPath of savedReadPaths.keys()) {
    if ((savedPath.split("?", 1)[0] || savedPath) !== route) continue;
    savedReadPaths.delete(savedPath);
    savedReadFailures.delete(savedPath);
  }
}

export function savedReadFailureIsCurrent(failedAt: number, now = Date.now()): boolean {
  return Number.isFinite(failedAt) && now - failedAt <= SAVED_READ_WARNING_TTL_MS;
}

async function hydratePersistedMutations(): Promise<void> {
  const persisted = await readMutations().catch(() => []);
  const queuedIds = new Set(pendingMutations.flatMap((entry) => entry.persisted ? [entry.persisted.id] : []));
  persisted.filter((entry) => !queuedIds.has(entry.id)).forEach((entry) => pendingMutations.push({
    path: entry.path,
    init: replayInit(entry),
    resolve: () => undefined,
    reject: () => undefined,
    attempts: entry.attempts,
    persisted: entry
  }));
  updateConnection({ queued: pendingMutations.length });
  if (pendingMutations.length) scheduleFlush(0);
}

function replayInit(mutation: PersistedMutation): RequestInit {
  return {
    method: mutation.method,
    body: mutation.body,
    headers: { ...(mutation.body ? { "Content-Type": "application/json" } : {}), ...(mutationAuthHeaders?.() || {}) }
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => updateConnection({ lastError: "Device is offline" }));
  window.addEventListener("online", () => { if (!pendingMutations.length) updateConnection({ lastError: undefined }); scheduleFlush(0); });
  window.addEventListener("focus", () => scheduleFlush(0));
}

export function mutationHeaders(csrfToken?: string): HeadersInit {
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}
