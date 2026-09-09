// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFireteamViewPreferences } from "./useFireteamViewPreferences";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useFireteamViewPreferences", () => {
  it("uses safe visible defaults for missing or invalid preferences", () => {
    const { result } = renderHook(() => useFireteamViewPreferences({
      membershipId: "",
      savedActivityFeedView: "expanded",
      savePreference: vi.fn()
    }));

    expect(result.current.activityFeedView).toBe("open");
    expect(result.current.activityFeedIsVisible).toBe(true);
    expect(result.current.activityFeedStorageKey).toBe(
      "guardian-nexus:fireteam-activity-window:guest"
    );
    expect(result.current.recentLootIsVisible).toBe(true);
  });

  it.each([
    ["open", true],
    ["minimized", true],
    ["hidden", false]
  ] as const)(
    "parses the %s activity-feed mode and visibility",
    (savedActivityFeedView, activityFeedIsVisible) => {
      const { result } = renderHook(() => useFireteamViewPreferences({
        membershipId: "membership-1",
        savedActivityFeedView,
        savePreference: vi.fn()
      }));

      expect(result.current.activityFeedView).toBe(savedActivityFeedView);
      expect(result.current.activityFeedIsVisible).toBe(activityFeedIsVisible);
    }
  );

  it("isolates activity-window storage between guest and member contexts", () => {
    const savePreference = vi.fn();
    const { result, rerender } = renderHook(
      ({ membershipId }) => useFireteamViewPreferences({
        membershipId,
        savePreference
      }),
      { initialProps: { membershipId: "" } }
    );

    expect(result.current.activityFeedStorageKey).toBe(
      "guardian-nexus:fireteam-activity-window:guest"
    );
    rerender({ membershipId: "membership-1" });
    expect(result.current.activityFeedStorageKey).toBe(
      "guardian-nexus:fireteam-activity-window:membership-1"
    );
  });

  it("only hides Recent Loot for the explicit off preference", () => {
    const savePreference = vi.fn();
    const { result, rerender } = renderHook(
      ({ savedRecentLootVisibility }) => useFireteamViewPreferences({
        membershipId: "membership-1",
        savedRecentLootVisibility,
        savePreference
      }),
      { initialProps: { savedRecentLootVisibility: "off" as string | undefined } }
    );

    expect(result.current.recentLootIsVisible).toBe(false);
    rerender({ savedRecentLootVisibility: "on" });
    expect(result.current.recentLootIsVisible).toBe(true);
    rerender({ savedRecentLootVisibility: "invalid" });
    expect(result.current.recentLootIsVisible).toBe(true);
  });

  it("writes each view action to its named preference", () => {
    const savePreference = vi.fn();
    const { result } = renderHook(() => useFireteamViewPreferences({
      membershipId: "membership-1",
      savePreference
    }));

    act(() => {
      result.current.changeActivityFeedView("minimized");
      result.current.hideRecentLoot();
      result.current.showRecentLoot();
    });

    expect(savePreference).toHaveBeenNthCalledWith(
      1,
      "fireteam.activityFeedView.v1",
      "minimized"
    );
    expect(savePreference).toHaveBeenNthCalledWith(
      2,
      "fireteam.recentLoot.v1",
      "off"
    );
    expect(savePreference).toHaveBeenNthCalledWith(
      3,
      "fireteam.recentLoot.v1",
      "on"
    );
  });
});
