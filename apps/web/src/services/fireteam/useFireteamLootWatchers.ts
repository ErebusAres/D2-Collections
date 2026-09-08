import type {
  LootWatcherConfig,
  LootWatcherRunResult,
  UserPreferenceKey,
  UserPreferencesData
} from "@guardian-nexus/contracts";
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, mutationHeaders } from "../api/client";

const LOOT_WATCHER_PREFERENCE_KEYS: Record<
  keyof LootWatcherConfig,
  UserPreferenceKey
> = {
  farmingMode: "fireteam.watcher.farming.v1",
  highestPowerLock: "fireteam.watcher.highestPower.v1",
  tier5FitLock: "fireteam.watcher.tier5Fits.v1",
  duplicateFitJunk: "fireteam.watcher.duplicateFits.v1"
};

interface UseFireteamLootWatchersOptions {
  characterId: string;
  csrfToken?: string;
  savedPreferences: UserPreferencesData["values"];
  savePreference: (key: UserPreferenceKey, value: string) => void;
}

function describeLootWatcherResult(result: LootWatcherRunResult): string {
  const completedActions = [
    result.movedToVault.length ? `${result.movedToVault.length} moved` : "",
    result.locked.length ? `${result.locked.length} locked` : "",
    result.taggedJunk.length ? `${result.taggedJunk.length} tagged junk` : ""
  ].filter(Boolean);

  if (result.warnings[0]) {
    return completedActions.length
      ? `${completedActions.join(" · ")} · ${result.warnings[0]}`
      : result.warnings[0];
  }
  if (result.skipped[0] && !completedActions.length) return result.skipped[0];
  return completedActions.length
    ? completedActions.join(" · ")
    : "Watcher settings saved.";
}

export function useFireteamLootWatchers({
  characterId,
  csrfToken,
  savedPreferences,
  savePreference
}: UseFireteamLootWatchersOptions) {
  const queryClient = useQueryClient();
  const lootWatchers = useMemo<LootWatcherConfig>(() => ({
    farmingMode:
      savedPreferences[LOOT_WATCHER_PREFERENCE_KEYS.farmingMode] === "on",
    highestPowerLock:
      savedPreferences[LOOT_WATCHER_PREFERENCE_KEYS.highestPowerLock] === "on",
    tier5FitLock:
      savedPreferences[LOOT_WATCHER_PREFERENCE_KEYS.tier5FitLock] === "on",
    duplicateFitJunk:
      savedPreferences[LOOT_WATCHER_PREFERENCE_KEYS.duplicateFitJunk] === "on"
  }), [savedPreferences]);
  const runLootWatchersMutation = useMutation({
    mutationFn: (configuration: LootWatcherConfig) => api<LootWatcherRunResult>(
      "/api/v2/fireteam/loot-watchers/run",
      {
        method: "POST",
        headers: mutationHeaders(csrfToken),
        body: JSON.stringify({ characterId, config: configuration })
      }
    ),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["fireteam-recent-items", characterId]
      }),
      queryClient.invalidateQueries({ queryKey: ["gear", characterId] })
    ])
  });

  const toggleLootWatcher = (
    watcher: keyof LootWatcherConfig,
    enabled: boolean
  ) => {
    const updatedLootWatchers = { ...lootWatchers, [watcher]: enabled };
    savePreference(
      LOOT_WATCHER_PREFERENCE_KEYS[watcher],
      enabled ? "on" : "off"
    );
    runLootWatchersMutation.mutate(updatedLootWatchers);
  };
  const lootWatcherStatus = runLootWatchersMutation.isPending
    ? "Updating watchers…"
    : runLootWatchersMutation.error instanceof Error
      ? runLootWatchersMutation.error.message
      : runLootWatchersMutation.data
        ? describeLootWatcherResult(runLootWatchersMutation.data.data)
        : undefined;

  return {
    lootWatchers,
    toggleLootWatcher,
    lootWatcherUpdatePending: runLootWatchersMutation.isPending,
    lootWatcherStatus
  };
}
