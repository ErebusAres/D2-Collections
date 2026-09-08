// @vitest-environment jsdom

import type { FireteamTrackedItem } from "@guardian-nexus/contracts";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFireteamTrackedCollections } from "./useFireteamTrackedCollections";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("useFireteamTrackedCollections", () => {
  it("loads each tracked collection from its owning storage source", () => {
    localStorage.setItem(
      "guardian-nexus:membership-1:character-1:quest-pins",
      JSON.stringify(["quest-1"])
    );
    const trackedBuild = build("build-1");
    const { result } = renderHook(() => useFireteamTrackedCollections({
      membershipId: "membership-1",
      characterId: "character-1",
      savedGuardianRankTracking: JSON.stringify(["rank-1"]),
      savedJourneyTracking: JSON.stringify(["journey-1"]),
      savedCollectionTracking: JSON.stringify(["collection-1"]),
      savedBuildTracking: JSON.stringify([trackedBuild])
    }));

    expect(result.current).toMatchObject({
      pinnedQuestStorageKey: "guardian-nexus:membership-1:character-1:quest-pins",
      pinnedQuestIds: ["quest-1"],
      trackedGuardianRankIds: ["rank-1"],
      trackedJourneyIds: ["journey-1"],
      trackedCollectionIds: ["collection-1"],
      trackedBuilds: [trackedBuild]
    });
  });

  it("returns empty collections for malformed or incorrectly shaped values", () => {
    localStorage.setItem(
      "guardian-nexus:membership-1:character-1:quest-pins",
      "not-json"
    );
    const { result } = renderHook(() => useFireteamTrackedCollections({
      membershipId: "membership-1",
      characterId: "character-1",
      savedGuardianRankTracking: "not-json",
      savedJourneyTracking: JSON.stringify({ id: "journey-1" }),
      savedCollectionTracking: "null",
      savedBuildTracking: JSON.stringify([{ kind: "quest" }])
    }));

    expect(result.current.pinnedQuestIds).toEqual([]);
    expect(result.current.trackedGuardianRankIds).toEqual([]);
    expect(result.current.trackedJourneyIds).toEqual([]);
    expect(result.current.trackedCollectionIds).toEqual([]);
    expect(result.current.trackedBuilds).toEqual([]);
  });

  it("filters invalid entries and enforces each collection size limit", () => {
    const identifiers = Array.from({ length: 205 }, (_, index) => `item-${index}`);
    const mixedIdentifiers = ["", 7, ...identifiers];
    const builds = Array.from({ length: 10 }, (_, index) => build(`build-${index}`));
    localStorage.setItem(
      "guardian-nexus:membership-1:character-1:quest-pins",
      JSON.stringify(mixedIdentifiers)
    );
    const { result } = renderHook(() => useFireteamTrackedCollections({
      membershipId: "membership-1",
      characterId: "character-1",
      savedGuardianRankTracking: JSON.stringify(mixedIdentifiers),
      savedJourneyTracking: JSON.stringify(mixedIdentifiers),
      savedCollectionTracking: JSON.stringify(mixedIdentifiers),
      savedBuildTracking: JSON.stringify(builds)
    }));

    expect(result.current.pinnedQuestIds).toHaveLength(40);
    expect(result.current.trackedGuardianRankIds).toHaveLength(200);
    expect(result.current.trackedJourneyIds).toHaveLength(200);
    expect(result.current.trackedCollectionIds).toHaveLength(200);
    expect(result.current.trackedBuilds).toHaveLength(8);
    expect(result.current.pinnedQuestIds[0]).toBe("item-0");
  });

  it("isolates local quest pins when membership or character context changes", async () => {
    localStorage.setItem(
      "guardian-nexus:membership-1:character-1:quest-pins",
      JSON.stringify(["first-context"])
    );
    localStorage.setItem(
      "guardian-nexus:membership-1:character-2:quest-pins",
      JSON.stringify(["second-character"])
    );
    localStorage.setItem(
      "guardian-nexus:membership-2:character-2:quest-pins",
      JSON.stringify(["second-membership"])
    );
    const { result, rerender } = renderHook(
      ({ membershipId, characterId }) => useFireteamTrackedCollections({
        membershipId,
        characterId
      }),
      { initialProps: { membershipId: "membership-1", characterId: "character-1" } }
    );

    expect(result.current.pinnedQuestIds).toEqual(["first-context"]);
    rerender({ membershipId: "membership-1", characterId: "character-2" });
    await waitFor(() => expect(result.current.pinnedQuestIds).toEqual([
      "second-character"
    ]));
    rerender({ membershipId: "membership-2", characterId: "character-2" });
    await waitFor(() => expect(result.current.pinnedQuestIds).toEqual([
      "second-membership"
    ]));
  });

  it("synchronizes externally updated preferences without overwriting local setters", async () => {
    const { result, rerender } = renderHook(
      ({ guardianRanks, journey, collection, builds }) =>
        useFireteamTrackedCollections({
          membershipId: "membership-1",
          characterId: "character-1",
          savedGuardianRankTracking: guardianRanks,
          savedJourneyTracking: journey,
          savedCollectionTracking: collection,
          savedBuildTracking: builds
        }),
      {
        initialProps: {
          guardianRanks: JSON.stringify(["rank-1"]),
          journey: JSON.stringify(["journey-1"]),
          collection: JSON.stringify(["collection-1"]),
          builds: JSON.stringify([build("build-1")])
        }
      }
    );

    act(() => result.current.setTrackedGuardianRankIds(["local-rank"]));
    expect(result.current.trackedGuardianRankIds).toEqual(["local-rank"]);

    rerender({
      guardianRanks: JSON.stringify(["rank-2"]),
      journey: JSON.stringify(["journey-2"]),
      collection: JSON.stringify(["collection-2"]),
      builds: JSON.stringify([build("build-2")])
    });

    await waitFor(() => expect(result.current.trackedGuardianRankIds).toEqual([
      "rank-2"
    ]));
    expect(result.current.trackedJourneyIds).toEqual(["journey-2"]);
    expect(result.current.trackedCollectionIds).toEqual(["collection-2"]);
    expect(result.current.trackedBuilds.map(({ id }) => id)).toEqual(["build-2"]);
  });

  it("does not read anonymous or incomplete quest-pin contexts", () => {
    localStorage.setItem(
      "guardian-nexus::character-1:quest-pins",
      JSON.stringify(["anonymous-pin"])
    );
    const { result } = renderHook(() => useFireteamTrackedCollections({
      membershipId: "",
      characterId: "character-1"
    }));

    expect(result.current.pinnedQuestStorageKey).toBe("");
    expect(result.current.pinnedQuestIds).toEqual([]);
  });
});

function build(id: string): FireteamTrackedItem {
  return {
    id,
    definitionHash: id,
    kind: "build",
    name: `Build ${id}`,
    description: "Tracked build",
    icon: "",
    context: "Build Advisor",
    trackedInDestiny: false,
    trackedInGuardianNexus: true,
    objectives: [],
    percent: 50,
    updatedAt: "2026-09-08T00:00:00.000Z"
  };
}
