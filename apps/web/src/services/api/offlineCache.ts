import type { ApiEnvelope } from "@guardian-nexus/contracts";

const DATABASE_NAME = "guardian-nexus-offline";
const DATABASE_VERSION = 1;
const RESPONSE_STORE = "responses";
const MUTATION_STORE = "mutations";
const CACHE_SCHEMA_VERSION = 1;

export interface CachedApiResponse<T = unknown> {
  envelope: ApiEnvelope<T>;
  savedAt: string;
}

export interface PersistedMutation {
  id: string;
  scope: string;
  path: string;
  method: string;
  body?: string;
  savedAt: string;
  expiresAt: string;
  attempts: number;
}

interface StoredResponse {
  key: string;
  scope: string;
  path: string;
  schemaVersion: number;
  savedAt: string;
  expiresAt: string;
  envelope: ApiEnvelope<unknown>;
}

interface CachePolicy {
  scope: "public" | "guardian";
  maxAgeMs: number;
}

let guardianScope = "";
let databasePromise: Promise<IDBDatabase> | undefined;

export function setOfflineCacheMembership(membershipId?: string): void {
  guardianScope = membershipId ? `guardian:${membershipId}` : "";
}

export function offlineCachePolicy(path: string): CachePolicy | undefined {
  const pathname = path.split("?", 1)[0] || path;
  if (pathname === "/api/v1/xur" || pathname === "/api/v1/builds" || (/^\/api\/v1\/builds\/[^/]+$/.test(pathname))) {
    return { scope: "public", maxAgeMs: 30 * 24 * 60 * 60_000 };
  }
  if (pathname.includes("/working-draft") || pathname.startsWith("/api/v1/dev/") || pathname === "/api/v1/session" || pathname.startsWith("/api/v1/auth/")) return undefined;
  if (pathname === "/api/v1/fireteam") return { scope: "guardian", maxAgeMs: 15 * 60_000 };
  if (pathname === "/api/v1/me/quests") return { scope: "guardian", maxAgeMs: 24 * 60 * 60_000 };
  if (pathname === "/api/v1/matrix") return { scope: "guardian", maxAgeMs: 7 * 24 * 60 * 60_000 };
  if (pathname.startsWith("/api/v1/me/")) return { scope: "guardian", maxAgeMs: 7 * 24 * 60 * 60_000 };
  return undefined;
}

export async function storeApiResponse<T>(path: string, envelope: ApiEnvelope<T>): Promise<void> {
  const identity = cacheIdentity(path);
  if (!identity) return;
  const savedAt = new Date().toISOString();
  const record: StoredResponse = {
    key: identity.key,
    scope: identity.scope,
    path,
    schemaVersion: CACHE_SCHEMA_VERSION,
    savedAt,
    expiresAt: new Date(Date.now() + identity.maxAgeMs).toISOString(),
    envelope: envelope as ApiEnvelope<unknown>
  };
  await put(RESPONSE_STORE, record);
}

export async function readApiResponse<T>(path: string): Promise<CachedApiResponse<T> | undefined> {
  const identity = cacheIdentity(path);
  if (!identity) return undefined;
  const record = await get<StoredResponse>(RESPONSE_STORE, identity.key);
  if (!record || record.schemaVersion !== CACHE_SCHEMA_VERSION || Date.parse(record.expiresAt) <= Date.now()) {
    if (record) await remove(RESPONSE_STORE, identity.key);
    return undefined;
  }
  return { envelope: record.envelope as ApiEnvelope<T>, savedAt: record.savedAt };
}

export async function storeMutation(input: Omit<PersistedMutation, "id" | "scope" | "savedAt" | "expiresAt" | "attempts">): Promise<PersistedMutation | undefined> {
  if (!guardianScope) return undefined;
  const mutation: PersistedMutation = {
    ...input,
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    scope: guardianScope,
    savedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
    attempts: 0
  };
  await put(MUTATION_STORE, mutation);
  return mutation;
}

export async function updateMutation(mutation: PersistedMutation): Promise<void> { await put(MUTATION_STORE, mutation); }
export async function removeMutation(id: string): Promise<void> { await remove(MUTATION_STORE, id); }

export async function readMutations(): Promise<PersistedMutation[]> {
  if (!guardianScope) return [];
  const mutations = (await getAll<PersistedMutation>(MUTATION_STORE))
    .filter((entry) => entry.scope === guardianScope)
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  const expired = mutations.filter((entry) => Date.parse(entry.expiresAt) <= Date.now());
  await Promise.all(expired.map((entry) => removeMutation(entry.id)));
  return mutations.filter((entry) => Date.parse(entry.expiresAt) > Date.now());
}

export async function clearGuardianOfflineData(): Promise<void> {
  if (typeof indexedDB !== "undefined") {
    const database = await openDatabase();
    await Promise.all([clearStore(database, RESPONSE_STORE), clearStore(database, MUTATION_STORE)]);
  }
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("guardian-nexus-")).map((key) => caches.delete(key)));
  }
}

function cacheIdentity(path: string): { key: string; scope: string; maxAgeMs: number } | undefined {
  const policy = offlineCachePolicy(path);
  if (!policy) return undefined;
  const scope = policy.scope === "public" ? "public" : guardianScope;
  return scope ? { key: `${scope}:${path}`, scope, maxAgeMs: policy.maxAgeMs } : undefined;
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable."));
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RESPONSE_STORE)) database.createObjectStore(RESPONSE_STORE, { keyPath: "key" });
      if (!database.objectStoreNames.contains(MUTATION_STORE)) database.createObjectStore(MUTATION_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open the Guardian Nexus offline database."));
  });
  return databasePromise;
}

async function put(storeName: string, value: unknown): Promise<void> {
  const database = await openDatabase();
  await requestComplete(database, storeName, "readwrite", (store) => store.put(value));
}

async function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase();
  return requestComplete<T | undefined>(database, storeName, "readonly", (store) => store.get(key));
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const database = await openDatabase();
  return requestComplete<T[]>(database, storeName, "readonly", (store) => store.getAll());
}

async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const database = await openDatabase();
  await requestComplete(database, storeName, "readwrite", (store) => store.delete(key));
}

function clearStore(database: IDBDatabase, storeName: string): Promise<void> {
  return requestComplete(database, storeName, "readwrite", (store) => store.clear());
}

function requestComplete<T = void>(database: IDBDatabase, storeName: string, mode: IDBTransactionMode, issue: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = issue(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error || new Error("Guardian Nexus offline storage failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Guardian Nexus offline storage was interrupted."));
  });
}
