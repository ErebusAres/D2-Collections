import type { FireteamMember, UserPreferenceKey } from "@guardian-nexus/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fireteamTrackedItemKey,
  legacyQuestToFireteamTrackedItem,
  orderedFireteamTrackedItemKeys
} from "./fireteamTrackedItems";

interface UseFireteamTrackedItemOrderOptions {
  currentGuardian?: FireteamMember;
  membershipId: string;
  characterId: string;
  savedTrackedItemOrder?: string;
  setPreference: (key: UserPreferenceKey, value: string) => void;
}

interface FireteamTrackedItemOrder {
  trackedItemOrder: string[];
  reorderTrackedItems: (sourceKey: string, targetKey: string) => void;
}

export function useFireteamTrackedItemOrder({
  currentGuardian,
  membershipId,
  characterId,
  savedTrackedItemOrder,
  setPreference
}: UseFireteamTrackedItemOrderOptions): FireteamTrackedItemOrder {
  const preferredTrackedItemOrder = useMemo(
    () => parseTrackedItemOrder(savedTrackedItemOrder),
    [savedTrackedItemOrder]
  );
  const [trackedItemOrder, setTrackedItemOrder] = useState(preferredTrackedItemOrder);
  useEffect(() => setTrackedItemOrder(preferredTrackedItemOrder), [preferredTrackedItemOrder]);

  const trackingContext = `${membershipId}:${characterId}`;
  const previousTrackingState = useRef<{
    context: string;
    trackedItemKeys: Set<string>;
  } | undefined>(undefined);
  const currentTrackedItems = currentGuardian
    ? Array.isArray(currentGuardian.trackedItems)
      ? currentGuardian.trackedItems
      : currentGuardian.quests.map(legacyQuestToFireteamTrackedItem)
    : [];
  const currentTrackedItemSignature = currentTrackedItems
    .map(fireteamTrackedItemKey)
    .sort()
    .join("|");

  useEffect(() => {
    if (!currentGuardian) return;
    const currentTrackedItemKeys = new Set(currentTrackedItems.map(fireteamTrackedItemKey));
    const previousState = previousTrackingState.current;
    previousTrackingState.current = {
      context: trackingContext,
      trackedItemKeys: currentTrackedItemKeys
    };

    if (!previousState || previousState.context !== trackingContext) {
      if (!trackedItemOrder.length && currentTrackedItemKeys.size) {
        saveTrackedItemOrder([...currentTrackedItemKeys]);
      }
      return;
    }

    const addedTrackedItemKeys = [...currentTrackedItemKeys].filter(
      (trackedItemKey) => !previousState.trackedItemKeys.has(trackedItemKey)
    );
    if (!addedTrackedItemKeys.length) return;
    const nextTrackedItemOrder = [
      ...addedTrackedItemKeys,
      ...orderedFireteamTrackedItemKeys(currentTrackedItems, trackedItemOrder)
        .filter((trackedItemKey) => !addedTrackedItemKeys.includes(trackedItemKey))
    ];
    saveTrackedItemOrder(nextTrackedItemOrder);
  }, [currentTrackedItemSignature, trackingContext]);

  function saveTrackedItemOrder(nextTrackedItemOrder: string[]): void {
    setTrackedItemOrder(nextTrackedItemOrder);
    setPreference("fireteam.trackedOrder", JSON.stringify(nextTrackedItemOrder));
  }

  function reorderTrackedItems(sourceKey: string, targetKey: string): void {
    if (!currentGuardian || sourceKey === targetKey) return;
    const nextTrackedItemOrder = orderedFireteamTrackedItemKeys(
      currentTrackedItems,
      trackedItemOrder
    );
    const sourceIndex = nextTrackedItemOrder.indexOf(sourceKey);
    const targetIndex = nextTrackedItemOrder.indexOf(targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    nextTrackedItemOrder.splice(
      targetIndex,
      0,
      nextTrackedItemOrder.splice(sourceIndex, 1)[0]!
    );
    saveTrackedItemOrder(nextTrackedItemOrder);
  }

  return { trackedItemOrder, reorderTrackedItems };
}

function parseTrackedItemOrder(savedTrackedItemOrder?: string): string[] {
  try {
    const parsedTrackedItemOrder = JSON.parse(savedTrackedItemOrder || "[]");
    return Array.isArray(parsedTrackedItemOrder)
      ? parsedTrackedItemOrder
        .filter((trackedItemKey): trackedItemKey is string => (
          typeof trackedItemKey === "string" && Boolean(trackedItemKey)
        ))
        .slice(0, 200)
      : [];
  } catch {
    return [];
  }
}
