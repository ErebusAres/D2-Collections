import type { SessionData, UpdateUserPreferenceRequest, UserPreferenceKey, UserPreferencesData } from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiRequestError, mutationHeaders, queuedApi } from "../services/api/client";

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
  preferences: UserPreferencesData["values"];
  setPreference: (key: UserPreferenceKey, value: string) => void;
  signIn: () => void;
  refresh: () => Promise<void>;
}

const GuardianContext = createContext<GuardianContextValue | null>(null);

function preferenceKey(membershipId: string | undefined, name: string): string {
  return `guardian-nexus:${membershipId || "anonymous"}:${name}`;
}

export function GuardianProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [autoRefresh, setAutoRefreshState] = useState(() => localStorage.getItem("guardian-nexus:auto-refresh") !== "false");
  const [reducedMotion, setReducedMotionState] = useState(() => localStorage.getItem("guardian-nexus:reduced-motion") === "true");
  const [preferences, setPreferencesState] = useState<UserPreferencesData["values"]>({});
  const sessionQuery = useQuery({
    queryKey: ["session", selectedCharacterId],
    queryFn: () => api<SessionData>(`/api/v1/session${selectedCharacterId ? `?characterId=${encodeURIComponent(selectedCharacterId)}` : ""}`),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
    retry: (failureCount, error) => (!(error instanceof ApiRequestError) || error.status === 408 || error.status === 429 || error.status >= 500) && failureCount < 3,
    retryDelay: (attempt, error) => error instanceof ApiRequestError && error.retryAfterSeconds
      ? Math.min(error.retryAfterSeconds * 1_000, 30_000)
      : Math.min(1_000 * 2 ** attempt, 5_000)
  });
  const session = sessionQuery.data?.data;
  const membershipId = session?.guardian?.membershipId;
  const preferencesQuery = useQuery({
    queryKey: ["preferences", membershipId],
    queryFn: () => api<UserPreferencesData>("/api/v1/me/preferences"),
    enabled: Boolean(session?.authenticated && membershipId),
    staleTime: 5 * 60_000,
    retry: 1
  });
  const preferenceMutation = useMutation({
    mutationFn: (input: UpdateUserPreferenceRequest) => queuedApi<UserPreferencesData>("/api/v1/me/preferences", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) })
  });

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
  }, [preferences]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);

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
    preferences,
    setPreference,
    signIn: () => { window.location.href = `/api/v1/auth/start?returnTo=${encodeURIComponent(window.location.pathname)}`; },
    refresh: async () => { await sessionQuery.refetch(); await queryClient.invalidateQueries(); }
  }), [session, sessionQuery.isLoading, sessionQuery.error, sessionQuery.refetch, selectedCharacterId, selectCharacter, autoRefresh, setAutoRefresh, reducedMotion, setReducedMotion, preferences, setPreference, queryClient]);

  return <GuardianContext.Provider value={value}>{children}</GuardianContext.Provider>;
}

export function useGuardian(): GuardianContextValue {
  const value = useContext(GuardianContext);
  if (!value) throw new Error("useGuardian must be used inside GuardianProvider.");
  return value;
}

export function pinsKey(membershipId: string, characterId: string): string {
  return `guardian-nexus:${membershipId}:${characterId}:quest-pins`;
}
