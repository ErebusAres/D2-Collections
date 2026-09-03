// @vitest-environment jsdom

import type { FireteamMember, FireteamTrackedItem } from "@guardian-nexus/contracts";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFireteamTrackedItemOrder } from "./useFireteamTrackedItemOrder";

afterEach(() => cleanup());

describe("useFireteamTrackedItemOrder", () => {
  it("establishes and saves an initial order when no preference exists", async () => {
    const setPreference = vi.fn();
    const currentGuardian = fireteamMember([trackedItem("first"), trackedItem("second")]);
    const { result } = renderHook(() => useFireteamTrackedItemOrder({
      currentGuardian,
      membershipId: "membership-1",
      characterId: "character-1",
      savedTrackedItemOrder: "[]",
      setPreference
    }));

    await waitFor(() => expect(result.current.trackedItemOrder).toEqual([
      "quest:first",
      "quest:second"
    ]));
    expect(setPreference).toHaveBeenCalledWith(
      "fireteam.trackedOrder",
      JSON.stringify(["quest:first", "quest:second"])
    );
  });

  it("synchronizes externally updated saved order without writing it again", async () => {
    const setPreference = vi.fn();
    const currentGuardian = fireteamMember([trackedItem("first"), trackedItem("second")]);
    const { result, rerender } = renderHook(
      ({ savedTrackedItemOrder }) => useFireteamTrackedItemOrder({
        currentGuardian,
        membershipId: "membership-1",
        characterId: "character-1",
        savedTrackedItemOrder,
        setPreference
      }),
      { initialProps: { savedTrackedItemOrder: JSON.stringify(["quest:second", "quest:first"]) } }
    );

    expect(result.current.trackedItemOrder).toEqual(["quest:second", "quest:first"]);
    rerender({ savedTrackedItemOrder: JSON.stringify(["quest:first", "quest:second"]) });
    await waitFor(() => expect(result.current.trackedItemOrder).toEqual([
      "quest:first",
      "quest:second"
    ]));
    expect(setPreference).not.toHaveBeenCalled();
  });

  it("places newly discovered tracked items before the saved order", async () => {
    const setPreference = vi.fn();
    const initialGuardian = fireteamMember([trackedItem("first"), trackedItem("second")]);
    const { result, rerender } = renderHook(
      ({ currentGuardian }) => useFireteamTrackedItemOrder({
        currentGuardian,
        membershipId: "membership-1",
        characterId: "character-1",
        savedTrackedItemOrder: JSON.stringify(["quest:first", "quest:second"]),
        setPreference
      }),
      { initialProps: { currentGuardian: initialGuardian } }
    );

    rerender({
      currentGuardian: fireteamMember([
        trackedItem("new"),
        trackedItem("first"),
        trackedItem("second")
      ])
    });
    await waitFor(() => expect(result.current.trackedItemOrder).toEqual([
      "quest:new",
      "quest:first",
      "quest:second"
    ]));
    expect(setPreference).toHaveBeenCalledWith(
      "fireteam.trackedOrder",
      JSON.stringify(["quest:new", "quest:first", "quest:second"])
    );
  });

  it("reorders valid tracked-item keys and persists the resulting order", () => {
    const setPreference = vi.fn();
    const currentGuardian = fireteamMember([
      trackedItem("first"),
      trackedItem("second"),
      trackedItem("third")
    ]);
    const { result } = renderHook(() => useFireteamTrackedItemOrder({
      currentGuardian,
      membershipId: "membership-1",
      characterId: "character-1",
      savedTrackedItemOrder: JSON.stringify([
        "quest:first",
        "quest:second",
        "quest:third"
      ]),
      setPreference
    }));

    act(() => result.current.reorderTrackedItems("quest:first", "quest:third"));

    expect(result.current.trackedItemOrder).toEqual([
      "quest:second",
      "quest:third",
      "quest:first"
    ]);
    expect(setPreference).toHaveBeenCalledWith(
      "fireteam.trackedOrder",
      JSON.stringify(["quest:second", "quest:third", "quest:first"])
    );
  });
});

function fireteamMember(trackedItems: FireteamTrackedItem[]): FireteamMember {
  return {
    membershipId: "membership-1",
    displayName: "Current Guardian",
    inGameName: "Current Guardian#0001",
    presenceLabel: "Fireteam member",
    onlineState: "online",
    activitySource: "shared",
    isSelf: true,
    isLeader: false,
    syncState: "synced",
    sharing: true,
    sharingMode: "persistent",
    trackedItems,
    quests: [],
    overlaps: [],
    freshness: {
      state: "fresh",
      observedAt: "2026-09-03T00:00:00.000Z",
      ageSeconds: 0
    }
  };
}

function trackedItem(id: string): FireteamTrackedItem {
  return {
    id,
    definitionHash: `definition-${id}`,
    kind: "quest",
    name: `Tracked item ${id}`,
    description: "Complete the objective.",
    icon: "",
    context: "Quest",
    trackedInDestiny: true,
    trackedInGuardianNexus: true,
    objectives: [],
    percent: 0,
    updatedAt: "2026-09-03T00:00:00.000Z"
  };
}
