import type { UserPreferenceKey } from "@guardian-nexus/contracts";
import { useCallback } from "react";

export type FireteamActivityFeedView = "open" | "minimized" | "hidden";

interface UseFireteamViewPreferencesOptions {
  membershipId: string;
  savedActivityFeedView?: string;
  savedRecentLootVisibility?: string;
  savePreference: (key: UserPreferenceKey, value: string) => void;
}

interface FireteamViewPreferences {
  activityFeedView: FireteamActivityFeedView;
  activityFeedIsVisible: boolean;
  activityFeedStorageKey: string;
  recentLootIsVisible: boolean;
  changeActivityFeedView: (view: FireteamActivityFeedView) => void;
  hideRecentLoot: () => void;
  showRecentLoot: () => void;
}

export function useFireteamViewPreferences({
  membershipId,
  savedActivityFeedView,
  savedRecentLootVisibility,
  savePreference
}: UseFireteamViewPreferencesOptions): FireteamViewPreferences {
  const activityFeedView = parseActivityFeedView(savedActivityFeedView);
  const activityFeedStorageKey = `guardian-nexus:fireteam-activity-window:${membershipId || "guest"}`;
  const recentLootIsVisible = savedRecentLootVisibility !== "off";

  const changeActivityFeedView = useCallback(
    (view: FireteamActivityFeedView) => {
      savePreference("fireteam.activityFeedView.v1", view);
    },
    [savePreference]
  );
  const hideRecentLoot = useCallback(() => {
    savePreference("fireteam.recentLoot.v1", "off");
  }, [savePreference]);
  const showRecentLoot = useCallback(() => {
    savePreference("fireteam.recentLoot.v1", "on");
  }, [savePreference]);

  return {
    activityFeedView,
    activityFeedIsVisible: activityFeedView !== "hidden",
    activityFeedStorageKey,
    recentLootIsVisible,
    changeActivityFeedView,
    hideRecentLoot,
    showRecentLoot
  };
}

function parseActivityFeedView(value?: string): FireteamActivityFeedView {
  return value === "minimized" || value === "hidden" ? value : "open";
}
