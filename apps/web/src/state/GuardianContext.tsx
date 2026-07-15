import type { SessionData } from "@guardian-nexus/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiRequestError } from "../api/client";

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
  const sessionQuery = useQuery({
    queryKey: ["session", selectedCharacterId],
    queryFn: () => api<SessionData>(`/api/v1/session${selectedCharacterId ? `?characterId=${encodeURIComponent(selectedCharacterId)}` : ""}`),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => error instanceof ApiRequestError && error.status >= 429 && failureCount < 2,
    retryDelay: (attempt, error) => error instanceof ApiRequestError && error.retryAfterSeconds
      ? Math.min(error.retryAfterSeconds * 1_000, 30_000)
      : Math.min(1_000 * 2 ** attempt, 5_000)
  });
  const session = sessionQuery.data?.data;
  const membershipId = session?.guardian?.membershipId;

  useEffect(() => {
    if (!session?.guardian) return;
    const stored = localStorage.getItem(preferenceKey(session.guardian.membershipId, "character"));
    const validStored = session.guardian.characters.some((character) => character.characterId === stored);
    const next = validStored ? stored! : session.guardian.selectedCharacterId;
    if (next && next !== selectedCharacterId) setSelectedCharacterId(next);
  }, [session?.guardian, selectedCharacterId]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);

  const selectCharacter = useCallback((id: string) => {
    setSelectedCharacterId(id);
    if (membershipId) localStorage.setItem(preferenceKey(membershipId, "character"), id);
    void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "session" });
  }, [membershipId, queryClient]);

  const setAutoRefresh = useCallback((value: boolean) => {
    setAutoRefreshState(value);
    localStorage.setItem("guardian-nexus:auto-refresh", String(value));
  }, []);

  const setReducedMotion = useCallback((value: boolean) => {
    setReducedMotionState(value);
    localStorage.setItem("guardian-nexus:reduced-motion", String(value));
  }, []);

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
    signIn: () => { window.location.href = `/api/v1/auth/start?returnTo=${encodeURIComponent(window.location.pathname)}`; },
    refresh: async () => { await sessionQuery.refetch(); await queryClient.invalidateQueries(); }
  }), [session, sessionQuery.isLoading, sessionQuery.error, sessionQuery.refetch, selectedCharacterId, selectCharacter, autoRefresh, setAutoRefresh, reducedMotion, setReducedMotion, queryClient]);

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
