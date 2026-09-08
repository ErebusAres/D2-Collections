// @vitest-environment jsdom

import type {
  FireteamTrackedItem,
  FireteamTrackedItemKind,
  UserPreferenceKey
} from "@guardian-nexus/contracts";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRETEAM_TRACKED_ITEM_EXIT_MS } from "./fireteamTrackedItems";
import { useFireteamTrackedItemRemoval } from "./useFireteamTrackedItemRemoval";

const setPinnedQuestIds = vi.fn();
const setTrackedGuardianRankIds = vi.fn();
const savePreference = vi.fn();
const updateSharedTrackedItems = vi.fn();

const currentPinnedQuestIds = ["item-1", "pin-2"];
const currentTrackedGuardianRankIds = ["item-1", "rank-2"];
const currentTrackedJourneyIds = ["item-1", "journey-2"];
const currentTrackedCollectionIds = [
  "item-1",
  "catalyst:item-1",
  "collection-2"
];
const currentTrackedBuilds = [
  trackedItem("build", "item-1"),
  trackedItem("build", "build-2")
];

interface TrackedItemGenreCase {
  kind: FireteamTrackedItemKind;
  preferenceKey?: UserPreferenceKey;
}

const trackedItemGenreCases: TrackedItemGenreCase[] = [
  { kind: "quest" },
  { kind: "bounty" },
  { kind: "order" },
  { kind: "guardian-rank", preferenceKey: "guardianRank.tracked" },
  { kind: "triumph", preferenceKey: "journey.tracked" },
  { kind: "title", preferenceKey: "journey.tracked" },
  { kind: "seasonal", preferenceKey: "journey.tracked" },
  { kind: "weekly", preferenceKey: "journey.tracked" },
  { kind: "exotic", preferenceKey: "collection.tracked" },
  { kind: "catalyst", preferenceKey: "collection.tracked" },
  { kind: "build", preferenceKey: "buildAdvisor.trackedBuilds.v1" }
];

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setPinnedQuestIds.mockReset();
  setTrackedGuardianRankIds.mockReset();
  savePreference.mockReset();
  updateSharedTrackedItems.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useFireteamTrackedItemRemoval", () => {
  it.each(trackedItemGenreCases)(
    "removes a $kind from its owning collection before updating sharing",
    ({ kind, preferenceKey }) => {
      const trackedItemToRemove = trackedItem(kind, "item-1");
      const { result } = renderRemovalHook();
      const expectedState = expectedSharedState(kind);

      act(() => result.current.removeTrackedItem(trackedItemToRemove));

      expect(result.current.removingTrackedItemKey).toBe(`${kind}:item-1`);
      expect(updateSharedTrackedItems).not.toHaveBeenCalled();
      if (kind !== "guardian-rank" && kind !== "build") {
        expect(setPinnedQuestIds).toHaveBeenCalledWith(["pin-2"]);
        expect(localStorage.getItem("guardian-pins")).toBe(
          JSON.stringify(["pin-2"])
        );
      } else {
        expect(setPinnedQuestIds).not.toHaveBeenCalled();
        expect(localStorage.getItem("guardian-pins")).toBeNull();
      }
      if (kind === "guardian-rank") {
        expect(setTrackedGuardianRankIds).toHaveBeenCalledWith(["rank-2"]);
      } else {
        expect(setTrackedGuardianRankIds).not.toHaveBeenCalled();
      }
      if (preferenceKey) {
        expect(savePreference).toHaveBeenCalledOnce();
        expect(savePreference).toHaveBeenCalledWith(
          preferenceKey,
          expectedPreferenceValue(kind, expectedState)
        );
      } else {
        expect(savePreference).not.toHaveBeenCalled();
      }

      act(() => vi.advanceTimersByTime(FIRETEAM_TRACKED_ITEM_EXIT_MS - 1));
      expect(updateSharedTrackedItems).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1));
      expect(updateSharedTrackedItems).toHaveBeenCalledOnce();
      expect(updateSharedTrackedItems).toHaveBeenCalledWith(
        expectedState,
        { onSettled: expect.any(Function) }
      );

      const callbacks = updateSharedTrackedItems.mock.calls[0]?.[1] as {
        onSettled: () => void;
      };
      act(() => callbacks.onSettled());
      expect(result.current.removingTrackedItemKey).toBe("");
    }
  );

  it("does nothing when Fireteam sharing is off", () => {
    const { result } = renderRemovalHook({ sharingMode: "off" });

    act(() => result.current.removeTrackedItem(trackedItem("quest", "item-1")));
    act(() => vi.advanceTimersByTime(FIRETEAM_TRACKED_ITEM_EXIT_MS));

    expect(result.current.removingTrackedItemKey).toBe("");
    expect(setPinnedQuestIds).not.toHaveBeenCalled();
    expect(setTrackedGuardianRankIds).not.toHaveBeenCalled();
    expect(savePreference).not.toHaveBeenCalled();
    expect(updateSharedTrackedItems).not.toHaveBeenCalled();
  });

  it("hides a Destiny-tracked item without removing unrelated local tracking", () => {
    const { result } = renderRemovalHook();
    const destinyOnlyItem = {
      ...trackedItem("weekly", "destiny-only"),
      trackedInGuardianNexus: false
    };

    act(() => result.current.removeTrackedItem(destinyOnlyItem));
    act(() => vi.advanceTimersByTime(FIRETEAM_TRACKED_ITEM_EXIT_MS));

    expect(setPinnedQuestIds).not.toHaveBeenCalled();
    expect(savePreference).not.toHaveBeenCalled();
    expect(updateSharedTrackedItems.mock.calls[0]?.[0]).toMatchObject({
      pinnedQuestIds: currentPinnedQuestIds,
      trackedJourneyIds: currentTrackedJourneyIds,
      hiddenTrackedItemKeys: ["hidden:item", "weekly:destiny-only"]
    });
  });

  it("removes a stale hidden key when the item is not tracked in Destiny", () => {
    const { result } = renderRemovalHook({
      currentHiddenTrackedItemKeys: ["hidden:item", "build:item-1"]
    });
    const localBuild = {
      ...trackedItem("build", "item-1"),
      trackedInDestiny: false
    };

    act(() => result.current.removeTrackedItem(localBuild));
    act(() => vi.advanceTimersByTime(FIRETEAM_TRACKED_ITEM_EXIT_MS));

    expect(updateSharedTrackedItems.mock.calls[0]?.[0]).toMatchObject({
      hiddenTrackedItemKeys: ["hidden:item"]
    });
  });
});

function renderRemovalHook(overrides: Record<string, unknown> = {}) {
  return renderHook(() => useFireteamTrackedItemRemoval({
    sharingMode: "persistent",
    pinnedQuestStorageKey: "guardian-pins",
    currentPinnedQuestIds,
    setPinnedQuestIds,
    currentTrackedGuardianRankIds,
    setTrackedGuardianRankIds,
    currentTrackedJourneyIds,
    currentTrackedCollectionIds,
    currentTrackedBuilds,
    currentHiddenTrackedItemKeys: ["hidden:item"],
    savePreference,
    updateSharedTrackedItems,
    ...overrides
  }));
}

function expectedSharedState(kind: FireteamTrackedItemKind) {
  const pinnedQuestIds = kind === "guardian-rank" || kind === "build"
    ? currentPinnedQuestIds
    : ["pin-2"];
  const trackedGuardianRankIds = kind === "guardian-rank"
    ? ["rank-2"]
    : currentTrackedGuardianRankIds;
  const trackedJourneyIds = ["triumph", "title", "seasonal", "weekly"]
    .includes(kind)
    ? ["journey-2"]
    : currentTrackedJourneyIds;
  const trackedCollectionIds = kind === "exotic"
    ? ["catalyst:item-1", "collection-2"]
    : kind === "catalyst"
      ? ["item-1", "collection-2"]
      : currentTrackedCollectionIds;
  const trackedBuilds = kind === "build"
    ? [currentTrackedBuilds[1]!]
    : currentTrackedBuilds;

  return {
    mode: "persistent" as const,
    pinnedQuestIds,
    trackedGuardianRankIds,
    trackedJourneyIds,
    trackedCollectionIds,
    trackedBuilds,
    hiddenTrackedItemKeys: ["hidden:item", `${kind}:item-1`],
    untrackingItemKey: `${kind}:item-1`
  };
}

function expectedPreferenceValue(
  kind: FireteamTrackedItemKind,
  expectedState: ReturnType<typeof expectedSharedState>
): string {
  if (kind === "guardian-rank") {
    return JSON.stringify(expectedState.trackedGuardianRankIds);
  }
  if (["triumph", "title", "seasonal", "weekly"].includes(kind)) {
    return JSON.stringify(expectedState.trackedJourneyIds);
  }
  if (kind === "exotic" || kind === "catalyst") {
    return JSON.stringify(expectedState.trackedCollectionIds);
  }
  return JSON.stringify(expectedState.trackedBuilds);
}

function trackedItem(
  kind: FireteamTrackedItemKind,
  id: string
): FireteamTrackedItem {
  return {
    id,
    definitionHash: `definition-${id}`,
    kind,
    name: `Tracked ${kind}`,
    description: "Complete the objective.",
    icon: "",
    context: kind,
    trackedInDestiny: true,
    trackedInGuardianNexus: true,
    objectives: [],
    percent: 0,
    updatedAt: "2026-09-08T00:00:00.000Z"
  };
}
