import type {
  FireteamSharingMode,
  FireteamTrackedItem,
  UserPreferenceKey
} from "@guardian-nexus/contracts";
import { catalystTrackingId } from "@guardian-nexus/domain";
import { useState } from "react";
import {
  fireteamTrackedItemKey,
  FIRETEAM_TRACKED_ITEM_EXIT_MS
} from "./fireteamTrackedItems";

interface SharedTrackedItemState {
  mode: FireteamSharingMode;
  pinnedQuestIds: string[];
  trackedGuardianRankIds: string[];
  trackedJourneyIds: string[];
  trackedCollectionIds: string[];
  trackedBuilds: FireteamTrackedItem[];
  hiddenTrackedItemKeys: string[];
  untrackingItemKey: string;
}

interface SharingUpdateCallbacks {
  onSettled: () => void;
}

interface UseFireteamTrackedItemRemovalOptions {
  sharingMode?: "off" | FireteamSharingMode;
  pinnedQuestStorageKey: string;
  currentPinnedQuestIds: string[];
  setPinnedQuestIds: (pinnedQuestIds: string[]) => void;
  currentTrackedGuardianRankIds: string[];
  setTrackedGuardianRankIds: (trackedGuardianRankIds: string[]) => void;
  currentTrackedJourneyIds: string[];
  currentTrackedCollectionIds: string[];
  currentTrackedBuilds: FireteamTrackedItem[];
  currentHiddenTrackedItemKeys: string[];
  savePreference: (key: UserPreferenceKey, value: string) => void;
  updateSharedTrackedItems: (
    state: SharedTrackedItemState,
    callbacks: SharingUpdateCallbacks
  ) => void;
}

const JOURNEY_TRACKED_ITEM_KINDS = new Set<FireteamTrackedItem["kind"]>([
  "triumph",
  "title",
  "seasonal",
  "weekly"
]);

export function useFireteamTrackedItemRemoval({
  sharingMode,
  pinnedQuestStorageKey,
  currentPinnedQuestIds,
  setPinnedQuestIds,
  currentTrackedGuardianRankIds,
  setTrackedGuardianRankIds,
  currentTrackedJourneyIds,
  currentTrackedCollectionIds,
  currentTrackedBuilds,
  currentHiddenTrackedItemKeys,
  savePreference,
  updateSharedTrackedItems
}: UseFireteamTrackedItemRemovalOptions) {
  const [removingTrackedItemKey, setRemovingTrackedItemKey] = useState("");

  const removeTrackedItem = (trackedItem: FireteamTrackedItem) => {
    if (!sharingMode || sharingMode === "off") return;

    const trackedItemKey = fireteamTrackedItemKey(trackedItem);
    const pinnedQuestIds = trackedItem.trackedInGuardianNexus
      && trackedItem.kind !== "guardian-rank"
      && trackedItem.kind !== "build"
      ? currentPinnedQuestIds.filter((pinnedQuestId) =>
        pinnedQuestId !== trackedItem.id)
      : currentPinnedQuestIds;
    const trackedGuardianRankIds = trackedItem.trackedInGuardianNexus
      && trackedItem.kind === "guardian-rank"
      ? currentTrackedGuardianRankIds.filter((guardianRankId) =>
        guardianRankId !== trackedItem.id)
      : currentTrackedGuardianRankIds;
    const trackedJourneyIds = trackedItem.trackedInGuardianNexus
      && JOURNEY_TRACKED_ITEM_KINDS.has(trackedItem.kind)
      ? currentTrackedJourneyIds.filter((journeyId) =>
        journeyId !== trackedItem.id)
      : currentTrackedJourneyIds;
    const collectionTrackingId = trackedItem.kind === "catalyst"
      ? catalystTrackingId(trackedItem.id)
      : trackedItem.id;
    const trackedCollectionIds = trackedItem.trackedInGuardianNexus
      && (trackedItem.kind === "exotic" || trackedItem.kind === "catalyst")
      ? currentTrackedCollectionIds.filter((collectionId) =>
        collectionId !== collectionTrackingId)
      : currentTrackedCollectionIds;
    const trackedBuilds = trackedItem.trackedInGuardianNexus
      && trackedItem.kind === "build"
      ? currentTrackedBuilds.filter((trackedBuild) =>
        trackedBuild.id !== trackedItem.id)
      : currentTrackedBuilds;
    const hiddenTrackedItemKeys = new Set(currentHiddenTrackedItemKeys);
    if (trackedItem.trackedInDestiny) {
      hiddenTrackedItemKeys.add(trackedItemKey);
    } else {
      hiddenTrackedItemKeys.delete(trackedItemKey);
    }

    if (pinnedQuestIds !== currentPinnedQuestIds) {
      setPinnedQuestIds(pinnedQuestIds);
      try {
        localStorage.setItem(
          pinnedQuestStorageKey,
          JSON.stringify(pinnedQuestIds)
        );
      } catch {
        // Keep the in-memory update when storage is unavailable.
      }
    }
    if (trackedGuardianRankIds !== currentTrackedGuardianRankIds) {
      setTrackedGuardianRankIds(trackedGuardianRankIds);
      savePreference(
        "guardianRank.tracked",
        JSON.stringify(trackedGuardianRankIds)
      );
    }
    if (trackedJourneyIds !== currentTrackedJourneyIds) {
      savePreference("journey.tracked", JSON.stringify(trackedJourneyIds));
    }
    if (trackedCollectionIds !== currentTrackedCollectionIds) {
      savePreference(
        "collection.tracked",
        JSON.stringify(trackedCollectionIds)
      );
    }
    if (trackedBuilds !== currentTrackedBuilds) {
      savePreference(
        "buildAdvisor.trackedBuilds.v1",
        JSON.stringify(trackedBuilds)
      );
    }

    setRemovingTrackedItemKey(trackedItemKey);
    window.setTimeout(() => {
      updateSharedTrackedItems({
        mode: sharingMode,
        pinnedQuestIds,
        trackedGuardianRankIds,
        trackedJourneyIds,
        trackedCollectionIds,
        trackedBuilds,
        hiddenTrackedItemKeys: [...hiddenTrackedItemKeys],
        untrackingItemKey: trackedItemKey
      }, {
        onSettled: () => setRemovingTrackedItemKey((currentKey) =>
          currentKey === trackedItemKey ? "" : currentKey)
      });
    }, FIRETEAM_TRACKED_ITEM_EXIT_MS);
  };

  return {
    removeTrackedItem,
    removingTrackedItemKey
  };
}
