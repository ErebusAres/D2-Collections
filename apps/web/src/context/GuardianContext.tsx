import type { ApiEnvelope, SessionData, UpdateUserPreferenceRequest, UserPreferenceKey, UserPreferencesData } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiRequestError, configureOfflineApi, mutationHeaders, queuedApi } from "../services/api/client";
import { HEADER_REFRESH_INTERVAL_MS } from "../services/liveRefresh";

interface GuardianContextValue {
  session?: SessionData;
  loading: boolean;
  error?: Error;
  selectedCharacterId: string;
  selectCharacter: (id: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  preferences: UserPreferencesData["values"];
  setPreference: (key: UserPreferenceKey, value: string) => void;
  signIn: () => void;
  refresh: () => Promise<void>;
}

const GuardianContext = createContext<GuardianContextValue | null>(null);
const SESSION_CACHE_KEY = "guardian-nexus:last-safe-session";

function readCachedSession(): ApiEnvelope<SessionData> | undefined {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY) || sessionStorage.getItem(SESSION_CACHE_KEY);
    const cached = JSON.parse(raw || "null") as ApiEnvelope<SessionData> | null;
    const age = cached?.freshness.observedAt ? Date.now() - Date.parse(cached.freshness.observedAt) : Number.POSITIVE_INFINITY;
    if (!cached?.data?.authenticated || !cached.data.guardian || age >= 7 * 24 * 60 * 60_000) return undefined;
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cached));
    sessionStorage.removeItem(SESSION_CACHE_KEY);
    return cached;
  } catch { return undefined; }
}

export function safeSessionForCache(envelope: ApiEnvelope<SessionData>): ApiEnvelope<SessionData> {
  return {
    ...envelope,
    data: {
      ...envelope.data,
      csrfToken: undefined,
      roles: { ...envelope.data.roles },
      rolesState: "stale",
      guardian: envelope.data.guardian ? { ...envelope.data.guardian, isInGame: false, currentActivity: undefined } : undefined
    },
    freshness: { ...envelope.freshness, state: "stale", observedAt: new Date().toISOString() },
    warnings: [...envelope.warnings, "Displaying the last safe session summary while Guardian services reconnect."]
  };
}

function cacheSafeSession(envelope: ApiEnvelope<SessionData> | undefined): void {
  sessionStorage.removeItem(SESSION_CACHE_KEY);
  if (!envelope?.data.authenticated || !envelope.data.guardian) { localStorage.removeItem(SESSION_CACHE_KEY); return; }
  localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(safeSessionForCache(envelope)));
}

function preferenceKey(membershipId: string | undefined, name: string): string {
  return `guardian-nexus:${membershipId || "anonymous"}:${name}`;
}

export function GuardianProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [autoRefresh, setAutoRefreshState] = useState(() => localStorage.getItem("guardian-nexus:auto-refresh") !== "false");
  const [reducedMotion, setReducedMotionState] = useState(() => localStorage.getItem("guardian-nexus:reduced-motion") === "true");
  const [highContrast, setHighContrastState] = useState(() => localStorage.getItem("guardian-nexus:high-contrast") === "true");
  const [preferences, setPreferencesState] = useState<UserPreferencesData["values"]>({});
  const sessionQuery = useQuery({
    queryKey: ["session", selectedCharacterId],
    queryFn: () => api<SessionData>(`/api/v1/session${selectedCharacterId ? `?characterId=${encodeURIComponent(selectedCharacterId)}` : ""}`),
    refetchInterval: autoRefresh ? HEADER_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    initialData: readCachedSession,
    initialDataUpdatedAt: 0,
    staleTime: 0,
    placeholderData: (previous) => previous,
    retry: shouldRetrySession,
    retryDelay: (attempt, error) => error instanceof ApiRequestError && error.retryAfterSeconds
      ? Math.min(error.retryAfterSeconds * 1_000, 30_000)
      : Math.min(1_000 * 2 ** attempt, 5_000)
  });
  const session = sessionQuery.data?.data;
  const membershipId = session?.guardian?.membershipId;
  configureOfflineApi(membershipId, () => mutationHeaders(session?.csrfToken));
  const preferencesQuery = useQuery({
    queryKey: ["preferences", membershipId],
    queryFn: () => api<UserPreferencesData>("/api/v1/me/preferences"),
    enabled: Boolean(session?.authenticated && membershipId),
    staleTime: 5 * 60_000,
    retry: 1
  });
  const preferenceMutation = useMutation({
    mutationFn: (input: UpdateUserPreferenceRequest) => queuedApi<UserPreferencesData>("/api/v1/me/preferences", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }, { persist: true })
  });

  useEffect(() => {
    if (!sessionQuery.data || sessionQuery.isPlaceholderData) return;
    cacheSafeSession(sessionQuery.data);
  }, [sessionQuery.data, sessionQuery.isPlaceholderData]);

  useEffect(() => {
    if (!membershipId) { setPreferencesState({}); return; }
    try { setPreferencesState(JSON.parse(localStorage.getItem(preferenceKey(membershipId, "preferences")) || "{}")); }
    catch { setPreferencesState({}); }
  }, [membershipId]);

  useEffect(() => {
    if (!membershipId || !preferencesQuery.data?.data.values) return;
    setPreferencesState((current) => {
      const next = { ...current, ...preferencesQuery.data!.data.values };
      localStorage.setItem(preferenceKey(membershipId, "preferences"), JSON.stringify(next));
      return next;
    });
  }, [membershipId, preferencesQuery.data]);

  useEffect(() => {
    if (!session?.guardian) return;
    const stored = preferences["site.character"] || localStorage.getItem(preferenceKey(session.guardian.membershipId, "character"));
    const validStored = session.guardian.characters.some((character) => character.characterId === stored);
    const next = validStored ? stored! : session.guardian.selectedCharacterId;
    if (next && next !== selectedCharacterId) setSelectedCharacterId(next);
  }, [session?.guardian, selectedCharacterId, preferences]);

  useEffect(() => {
    if (preferences["site.autoRefresh"] !== undefined) setAutoRefreshState(preferences["site.autoRefresh"] !== "false");
    if (preferences["site.reducedMotion"] !== undefined) setReducedMotionState(preferences["site.reducedMotion"] === "true");
    if (preferences["site.highContrast"] !== undefined) setHighContrastState(preferences["site.highContrast"] === "true");
  }, [preferences]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
    document.documentElement.dataset.highContrast = String(highContrast);
    delete document.documentElement.dataset.textScale;
    document.documentElement.lang = "en";
    localStorage.removeItem("guardian-nexus:text-scale");
    localStorage.removeItem("guardian-nexus:locale");
  }, [highContrast, reducedMotion]);

  useEffect(() => {
    if (highContrast) void import("../styles/accessibility.css");
  }, [highContrast]);

  const setPreference = useCallback((key: UserPreferenceKey, preferenceValue: string) => {
    if (!membershipId) return;
    setPreferencesState((current) => {
      const next = { ...current, [key]: preferenceValue };
      localStorage.setItem(preferenceKey(membershipId, "preferences"), JSON.stringify(next));
      return next;
    });
    preferenceMutation.mutate({ key, value: preferenceValue });
  }, [membershipId, preferenceMutation]);

  const selectCharacter = useCallback((id: string) => {
    setSelectedCharacterId(id);
    if (membershipId) localStorage.setItem(preferenceKey(membershipId, "character"), id);
    setPreference("site.character", id);
    void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "session" });
  }, [membershipId, queryClient, setPreference]);

  const setAutoRefresh = useCallback((value: boolean) => {
    setAutoRefreshState(value);
    localStorage.setItem("guardian-nexus:auto-refresh", String(value));
    setPreference("site.autoRefresh", String(value));
  }, [setPreference]);

  const setReducedMotion = useCallback((value: boolean) => {
    setReducedMotionState(value);
    localStorage.setItem("guardian-nexus:reduced-motion", String(value));
    setPreference("site.reducedMotion", String(value));
  }, [setPreference]);

  const setHighContrast = useCallback((value: boolean) => {
    setHighContrastState(value); localStorage.setItem("guardian-nexus:high-contrast", String(value)); setPreference("site.highContrast", String(value));
  }, [setPreference]);

  const value = useMemo<GuardianContextValue>(() => ({
    session,
    loading: sessionQuery.isLoading,
    error: sessionQuery.error as Error | undefined,
    selectedCharacterId,
    selectCharacter,
    autoRefresh,
    setAutoRefresh,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    preferences,
    setPreference,
    signIn: () => { window.location.href = `/api/v1/auth/start?returnTo=${encodeURIComponent(window.location.pathname)}`; },
    refresh: async () => { await sessionQuery.refetch(); await queryClient.invalidateQueries(); }
  }), [session, sessionQuery.isLoading, sessionQuery.error, sessionQuery.refetch, selectedCharacterId, selectCharacter, autoRefresh, setAutoRefresh, reducedMotion, setReducedMotion, highContrast, setHighContrast, preferences, setPreference, queryClient]);

  return <GuardianContext.Provider value={value}>{children}</GuardianContext.Provider>;
}

export function useGuardian(): GuardianContextValue {
  const value = useContext(GuardianContext);
  if (!value) throw new Error("useGuardian must be used inside GuardianProvider.");
  return value;
}

export function shouldRetrySession(failureCount: number, error: unknown): boolean {
  return failureCount < 3 && (!(error instanceof ApiRequestError)
    || (error.code !== "worker_resource_limit" && (error.status === 408 || error.status === 429 || error.status >= 500)));
}

export function pinsKey(membershipId: string, characterId: string): string {
  return `guardian-nexus:${membershipId}:${characterId}:quest-pins`;
}
