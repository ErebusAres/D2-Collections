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

let connectionSnapshot: ConnectionSnapshot = { queued: 0, retrying: false, ...(typeof navigator !== "undefined" && !navigator.onLine ? { lastError: "Device is offline" } : {}) };
const connectionListeners = new Set<() => void>();
const pendingMutations: PendingMutation[] = [];
let flushTimer: number | undefined;
let flushing = false;
const inFlightReads = new Map<string, Promise<ApiEnvelope<unknown>>>();
const savedReadPaths = new Map<string, string>();
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
    savedReadPaths.delete(path);
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
    updateSavedDataConnection({ lastError: messageOf(error) });
    return {
      ...cached.envelope,
      freshness: { ...cached.envelope.freshness, state: offline ? "offline" : "stale", ageSeconds },
      warnings: [...cached.envelope.warnings.filter((warning) => !warning.startsWith("Showing saved Guardian data")), `Showing saved Guardian data from ${new Date(cached.savedAt).toLocaleString()} while live services reconnect.`]
    };
  }
}

async function performRequest<T>(path: string, init: RequestInit): Promise<ApiEnvelope<T>> {
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
    if (!response.ok && /1102|exceeded resource limits/i.test(raw)) body = { code: "worker_resource_limit", message: "Guardian services are temporarily over capacity." };
  }
  if (!response.ok) {
    const error = new ApiRequestError(response.status, body);
    if (isTransient(error)) updateConnection({ lastError: error.message });
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
  const savedAt = [...savedReadPaths.values()].sort()[0];
  updateConnection({ ...value, usingSavedData: savedReadPaths.size > 0, lastSavedAt: savedAt, ...(!savedReadPaths.size ? { lastError: undefined } : {}) });
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
