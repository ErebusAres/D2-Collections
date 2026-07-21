import type { ApiEnvelope, ApiError } from "@guardian-nexus/contracts";

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
}

interface PendingMutation {
  path: string;
  init: RequestInit;
  resolve: (value: ApiEnvelope<unknown>) => void;
  reject: (reason: unknown) => void;
  attempts: number;
}

let connectionSnapshot: ConnectionSnapshot = { queued: 0, retrying: false };
const connectionListeners = new Set<() => void>();
const pendingMutations: PendingMutation[] = [];
let flushTimer: number | undefined;
let flushing = false;
const inFlightReads = new Map<string, Promise<ApiEnvelope<unknown>>>();

export function api<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const method = String(init.method || "GET").toUpperCase();
  if (method !== "GET" || init.body) return performRequest<T>(path, init);
  const existing = inFlightReads.get(path);
  if (existing) return existing as Promise<ApiEnvelope<T>>;
  const request = performRequest<T>(path, init);
  inFlightReads.set(path, request as Promise<ApiEnvelope<unknown>>);
  void request.finally(() => { if (inFlightReads.get(path) === request) inFlightReads.delete(path); }).catch(() => undefined);
  return request;
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
  if (!pendingMutations.length) updateConnection({ lastError: undefined });
  return body as ApiEnvelope<T>;
}

export function queuedApi<T>(path: string, init: RequestInit): Promise<ApiEnvelope<T>> {
  return api<T>(path, init).catch((error) => {
    if (!isTransient(error)) throw error;
    return new Promise<ApiEnvelope<T>>((resolve, reject) => {
      pendingMutations.push({ path, init, resolve: resolve as (value: ApiEnvelope<unknown>) => void, reject, attempts: 0 });
      updateConnection({ queued: pendingMutations.length, lastError: messageOf(error) });
      scheduleFlush(2_000);
    });
  });
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
      const result = await api<unknown>(pending.path, pending.init);
      pendingMutations.shift();
      pending.resolve(result);
      updateConnection({ queued: pendingMutations.length, lastError: undefined });
    } catch (error) {
      if (!isTransient(error)) {
        pendingMutations.shift();
        pending.reject(error);
        updateConnection({ queued: pendingMutations.length, lastError: messageOf(error) });
        continue;
      }
      pending.attempts += 1;
      updateConnection({ lastError: messageOf(error) });
      scheduleFlush(Math.min(60_000, 2_000 * 2 ** Math.min(5, pending.attempts)));
      break;
    }
  }
  flushing = false;
  updateConnection({ retrying: false });
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => updateConnection({ lastError: "Device is offline" }));
  window.addEventListener("online", () => { if (!pendingMutations.length) updateConnection({ lastError: undefined }); scheduleFlush(0); });
  window.addEventListener("focus", () => scheduleFlush(0));
}

export function mutationHeaders(csrfToken?: string): HeadersInit {
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}
