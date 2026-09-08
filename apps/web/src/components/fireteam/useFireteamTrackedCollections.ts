import type { FireteamTrackedItem } from "@guardian-nexus/contracts";
import { useEffect, useMemo, useState } from "react";
import { pinsKey } from "../../context/GuardianContext";
import { parseTrackedBuilds } from "../../modules/buildAdvisor/buildTracking";

interface UseFireteamTrackedCollectionsOptions {
  membershipId: string;
  characterId: string;
  savedGuardianRankTracking?: string;
  savedJourneyTracking?: string;
  savedCollectionTracking?: string;
  savedBuildTracking?: string;
}

interface FireteamTrackedCollections {
  pinnedQuestStorageKey: string;
  pinnedQuestIds: string[];
  setPinnedQuestIds: (pinnedQuestIds: string[]) => void;
  trackedGuardianRankIds: string[];
  setTrackedGuardianRankIds: (trackedGuardianRankIds: string[]) => void;
  trackedJourneyIds: string[];
  trackedCollectionIds: string[];
  trackedBuilds: FireteamTrackedItem[];
}

const MAX_PINNED_QUESTS = 40;
const MAX_TRACKED_IDENTIFIERS = 200;

export function useFireteamTrackedCollections({
  membershipId,
  characterId,
  savedGuardianRankTracking,
  savedJourneyTracking,
  savedCollectionTracking,
  savedBuildTracking
}: UseFireteamTrackedCollectionsOptions): FireteamTrackedCollections {
  const pinnedQuestStorageKey = membershipId && characterId
    ? pinsKey(membershipId, characterId)
    : "";
  const [pinnedQuestIds, setPinnedQuestIds] = useState(() =>
    readTrackedIdentifiersFromStorage(pinnedQuestStorageKey, MAX_PINNED_QUESTS)
  );
  useEffect(() => {
    setPinnedQuestIds(
      readTrackedIdentifiersFromStorage(pinnedQuestStorageKey, MAX_PINNED_QUESTS)
    );
  }, [pinnedQuestStorageKey]);

  const savedGuardianRankIds = useMemo(
    () => parseTrackedIdentifiers(
      savedGuardianRankTracking,
      MAX_TRACKED_IDENTIFIERS
    ),
    [savedGuardianRankTracking]
  );
  const [trackedGuardianRankIds, setTrackedGuardianRankIds] = useState(
    savedGuardianRankIds
  );
  useEffect(() => {
    setTrackedGuardianRankIds(savedGuardianRankIds);
  }, [savedGuardianRankIds]);

  const trackedJourneyIds = useMemo(
    () => parseTrackedIdentifiers(savedJourneyTracking, MAX_TRACKED_IDENTIFIERS),
    [savedJourneyTracking]
  );
  const trackedCollectionIds = useMemo(
    () => parseTrackedIdentifiers(
      savedCollectionTracking,
      MAX_TRACKED_IDENTIFIERS
    ),
    [savedCollectionTracking]
  );
  const trackedBuilds = useMemo(
    () => parseTrackedBuilds(savedBuildTracking),
    [savedBuildTracking]
  );

  return {
    pinnedQuestStorageKey,
    pinnedQuestIds,
    setPinnedQuestIds,
    trackedGuardianRankIds,
    setTrackedGuardianRankIds,
    trackedJourneyIds,
    trackedCollectionIds,
    trackedBuilds
  };
}

function parseTrackedIdentifiers(value: string | undefined, limit: number): string[] {
  try {
    const parsedValue = JSON.parse(value || "[]");
    return Array.isArray(parsedValue)
      ? parsedValue
        .filter((identifier): identifier is string => (
          typeof identifier === "string" && Boolean(identifier)
        ))
        .slice(0, limit)
      : [];
  } catch {
    return [];
  }
}

function readTrackedIdentifiersFromStorage(
  storageKey: string,
  limit: number
): string[] {
  if (!storageKey) return [];
  try {
    return parseTrackedIdentifiers(localStorage.getItem(storageKey) || undefined, limit);
  } catch {
    return [];
  }
}
