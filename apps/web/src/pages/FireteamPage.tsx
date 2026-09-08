import type { FireteamTrackedItem } from "@guardian-nexus/contracts";
import { catalystTrackingId } from "@guardian-nexus/domain";
import { useEffect, useMemo, useState } from "react";
import { AuthGate, QueryState } from "../components/common/Page";
import {
  FIRETEAM_BUNGIE_DATA_NOTICE,
  FireteamDataNotice
} from "../components/fireteam/FireteamDataNotice";
import { FireteamRecentLootSection } from "../components/fireteam/FireteamRecentLootSection";
import { FireteamRoster } from "../components/fireteam/FireteamRoster";
import { FireteamSharingHeader } from "../components/fireteam/FireteamSharingHeader";
import {
  fireteamTrackedItemKey,
  FIRETEAM_TRACKED_ITEM_EXIT_MS
} from "../components/fireteam/fireteamTrackedItems";
import { useFireteamTrackedItemOrder } from "../components/fireteam/useFireteamTrackedItemOrder";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { primeCompletionAudio } from "../services/completionAudio";
import { parseTrackedBuilds } from "../modules/buildAdvisor/buildTracking";
import styles from "./Pages.module.css";

import { FireteamActivityFeed, type FireteamActivityFeedView } from "../components/fireteam/FireteamActivityFeed";
import { useFireteamActivityFeed } from "../services/fireteam/useFireteamActivityFeed";
import { useFireteamLootWatchers } from "../services/fireteam/useFireteamLootWatchers";
import { useFireteamQuery } from "../services/fireteam/useFireteamQuery";
import { useFireteamRecentLoot } from "../services/fireteam/useFireteamRecentLoot";
import { useFireteamSharing } from "../services/fireteam/useFireteamSharing";

export function FireteamPage() {
  const { session, selectedCharacterId, preferences, setPreference, autoRefresh } = useGuardian();
  const result = useFireteamQuery(session?.guardian?.membershipId || "", selectedCharacterId, Boolean(session?.authenticated));
  useEffect(() => {
    const prime = () => {
      primeCompletionAudio();
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
    window.addEventListener("pointerdown", prime);
    window.addEventListener("keydown", prime);
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);
  const data = result.data?.data;
  const membershipId = session?.guardian?.membershipId || "";
  const storageKey = membershipId && selectedCharacterId ? pinsKey(membershipId, selectedCharacterId) : "";
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedIds(storageKey));
  useEffect(() => setPinnedIds(readPinnedIds(storageKey)), [storageKey]);
  const preferenceGuardianRankIds = useMemo(() => trackedPreference(preferences["guardianRank.tracked"]), [preferences]);
  const [guardianRankIds, setGuardianRankIds] = useState(preferenceGuardianRankIds);
  useEffect(() => setGuardianRankIds(preferenceGuardianRankIds), [preferences["guardianRank.tracked"]]);
  const journeyIds = useMemo(() => trackedPreference(preferences["journey.tracked"]), [preferences]);
  const collectionIds = useMemo(() => trackedPreference(preferences["collection.tracked"]), [preferences]);
  const trackedBuilds = useMemo(() => parseTrackedBuilds(preferences["buildAdvisor.trackedBuilds.v1"]), [preferences]);
  const activityFeedView = parseActivityFeedView(preferences["fireteam.activityFeedView.v1"]);
  const showRecentLoot = preferences["fireteam.recentLoot.v1"] !== "off";
  const {
    lootWatchers,
    toggleLootWatcher,
    lootWatcherUpdatePending,
    lootWatcherStatus
  } = useFireteamLootWatchers({
    characterId: selectedCharacterId,
    csrfToken: session?.csrfToken,
    savedPreferences: preferences,
    savePreference: setPreference
  });
  const {
    recentLootEvents,
    recentLootLoading,
    recentLootLoadError,
    recentLootWarnings,
    recentLootRetentionDays,
    recentLootObservedAt,
    recentLootFirstObservationEstablished,
    retryRecentLoot,
    updateRecentLootItemTag,
    pullRecentLootItemToCharacter,
    changeRecentLootWeaponSocket,
    recentLootActionPending,
    recentLootActionError
  } = useFireteamRecentLoot({
    characterId: selectedCharacterId,
    authenticated: Boolean(session?.authenticated),
    recentLootIsVisible: showRecentLoot,
    csrfToken: session?.csrfToken
  });
  const {
    displayedActivityFeed,
    sendActivityMessage,
    activityMessageSending,
    activityFeedError
  } = useFireteamActivityFeed({
    membershipId,
    characterId: selectedCharacterId,
    authenticated: Boolean(session?.authenticated),
    feedIsVisible: activityFeedView !== "hidden",
    autoRefresh,
    csrfToken: session?.csrfToken,
    snapshotActivityFeed: data?.activityFeed,
    snapshotActivityFeedEnabled: data?.activityFeedEnabled
  });
  const hiddenTrackedItemKeys = data?.hiddenTrackedItemKeys || [];
  const [manualRemovingKey, setManualRemovingKey] = useState("");
  const {
    updateFireteamSharing,
    stopFireteamSharing,
    sharingUpdatePending,
    stopSharingPending,
    updatingUntrackingItemKey
  } = useFireteamSharing({
    characterId: selectedCharacterId,
    csrfToken: session?.csrfToken,
    currentPinnedQuestIds: pinnedIds,
    currentTrackedGuardianRankIds: guardianRankIds,
    currentTrackedJourneyIds: journeyIds,
    currentTrackedCollectionIds: collectionIds,
    currentTrackedBuilds: trackedBuilds,
    currentHiddenTrackedItemKeys: hiddenTrackedItemKeys
  });
  const sharingMode = data?.sharingMode;
  const self = data?.members.find((member) => member.isSelf);
  const { trackedItemOrder, reorderTrackedItems } = useFireteamTrackedItemOrder({
    currentGuardian: self,
    membershipId,
    characterId: selectedCharacterId,
    savedTrackedItemOrder: preferences["fireteam.trackedOrder"],
    setPreference
  });
  const [copied, setCopied] = useState("");
  const copyCommand = async (label: string, command: string) => {
    if (!navigator.clipboard?.writeText) return;
    try { await navigator.clipboard.writeText(command); } catch { return; }
    setCopied(label);
    window.setTimeout(() => setCopied((current) => current === label ? "" : current), 1800);
  };
  const untrackItem = (item: FireteamTrackedItem) => {
    if (!sharingMode || sharingMode === "off") return;
    const key = fireteamTrackedItemKey(item);
    const nextPinnedIds = !["guardian-rank", "build"].includes(item.kind) && item.trackedInGuardianNexus
      ? pinnedIds.filter((id) => id !== item.id)
      : pinnedIds;
    const nextGuardianRankIds = item.kind === "guardian-rank" && item.trackedInGuardianNexus
      ? guardianRankIds.filter((id) => id !== item.id)
      : guardianRankIds;
    const nextJourneyIds = !["quest", "bounty", "order", "guardian-rank", "exotic", "catalyst", "build"].includes(item.kind) && item.trackedInGuardianNexus
      ? journeyIds.filter((id) => id !== item.id)
      : journeyIds;
    const collectionTrackingId = item.kind === "catalyst" ? catalystTrackingId(item.id) : item.id;
    const nextCollectionIds = ["exotic", "catalyst"].includes(item.kind) && item.trackedInGuardianNexus
      ? collectionIds.filter((id) => id !== collectionTrackingId)
      : collectionIds;
    const nextTrackedBuilds = item.kind === "build" && item.trackedInGuardianNexus
      ? trackedBuilds.filter((build) => build.id !== item.id)
      : trackedBuilds;
    const nextHiddenKeys = new Set(hiddenTrackedItemKeys);
    if (item.trackedInDestiny) nextHiddenKeys.add(key); else nextHiddenKeys.delete(key);
    const hiddenKeys = [...nextHiddenKeys];

    if (nextPinnedIds !== pinnedIds) {
      setPinnedIds(nextPinnedIds);
      try { localStorage.setItem(storageKey, JSON.stringify(nextPinnedIds)); } catch { /* Keep the in-memory update. */ }
    }
    if (nextGuardianRankIds !== guardianRankIds) {
      setGuardianRankIds(nextGuardianRankIds);
      setPreference("guardianRank.tracked", JSON.stringify(nextGuardianRankIds));
    }
    if (nextJourneyIds !== journeyIds) setPreference("journey.tracked", JSON.stringify(nextJourneyIds));
    if (nextCollectionIds !== collectionIds) setPreference("collection.tracked", JSON.stringify(nextCollectionIds));
    if (nextTrackedBuilds !== trackedBuilds) setPreference("buildAdvisor.trackedBuilds.v1", JSON.stringify(nextTrackedBuilds));

    setManualRemovingKey(key);
    window.setTimeout(() => {
      updateFireteamSharing({
        mode: sharingMode,
        pinnedQuestIds: nextPinnedIds,
        trackedGuardianRankIds: nextGuardianRankIds,
        trackedJourneyIds: nextJourneyIds,
        trackedCollectionIds: nextCollectionIds,
        trackedBuilds: nextTrackedBuilds,
        hiddenTrackedItemKeys: hiddenKeys,
        untrackingItemKey: key
      }, { onSettled: () => setManualRemovingKey((current) => current === key ? "" : current) });
    }, FIRETEAM_TRACKED_ITEM_EXIT_MS);
  };

  return <AuthGate>
    <div className={styles.fireteamUpper}>
    <FireteamSharingHeader
      lastUpdatedAt={data?.pageUpdatedAt}
      statusWarning={result.data?.warnings.find(
        (warning) => warning !== FIRETEAM_BUNGIE_DATA_NOTICE
      )}
      sharingEnabled={data?.sharingEnabled}
      sharingMode={data?.sharingMode}
      sharingUpdatePending={sharingUpdatePending}
      stopSharingPending={stopSharingPending}
      onShareTemporarily={() => updateFireteamSharing({ mode: "temporary" })}
      onSharePersistently={() => updateFireteamSharing({ mode: "persistent" })}
      onStopSharing={stopFireteamSharing}
    />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    <FireteamRecentLootSection
      isVisible={showRecentLoot}
      recentLootEvents={recentLootEvents}
      isLoading={recentLootLoading}
      loadError={recentLootLoadError}
      warnings={recentLootWarnings}
      retentionDays={recentLootRetentionDays}
      observedAt={recentLootObservedAt}
      firstObservationEstablished={recentLootFirstObservationEstablished}
      onRetry={retryRecentLoot}
      onTagItem={(item, tag) => updateRecentLootItemTag(item.instanceId, tag)}
      onPullItem={(item) => pullRecentLootItemToCharacter(item.instanceId)}
      onChangeWeaponSocket={(item, socketIndex, plugItemHash) =>
        changeRecentLootWeaponSocket(item.instanceId, socketIndex, plugItemHash)}
      actionsPending={recentLootActionPending}
      onHide={() => setPreference("fireteam.recentLoot.v1", "off")}
      onShow={() => setPreference("fireteam.recentLoot.v1", "on")}
      watchers={lootWatchers}
      onWatcherChange={toggleLootWatcher}
      watcherUpdatePending={lootWatcherUpdatePending}
      watcherStatus={lootWatcherStatus}
      actionError={recentLootActionError}
    />
    </div>
    {data && <FireteamRoster
      members={data.members}
      currentGuardianIsLeader={Boolean(self?.isLeader)}
      copiedCommandIdentifier={copied}
      onCopyCommand={copyCommand}
      onUntrackCurrentGuardianItem={untrackItem}
      currentGuardianTrackedItemOrder={trackedItemOrder}
      onReorderCurrentGuardianTrackedItem={reorderTrackedItems}
      currentGuardianUntrackingItemKey={manualRemovingKey || updatingUntrackingItemKey}
    />}
    {session?.authenticated && <FireteamActivityFeed
      feed={displayedActivityFeed}
      view={activityFeedView}
      storageKey={`guardian-nexus:fireteam-activity-window:${membershipId || "guest"}`}
      onViewChange={(view) => setPreference("fireteam.activityFeedView.v1", view)}
      onSend={sendActivityMessage}
      sending={activityMessageSending}
      error={activityFeedError}
      onDisable={() => data?.sharingMode && data.sharingMode !== "off" && updateFireteamSharing({
        mode: data.sharingMode,
        activityFeedEnabled: false
      })}
      onEnable={() => data?.sharingMode && data.sharingMode !== "off" && updateFireteamSharing({
        mode: data.sharingMode,
        activityFeedEnabled: true
      })}
    />}
    {data && <FireteamDataNotice />}
  </AuthGate>;
}

function trackedPreference(value?: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, 200) : [];
  } catch { return []; }
}

function parseActivityFeedView(value?: string): FireteamActivityFeedView {
  return value === "minimized" || value === "hidden" ? value : "open";
}

function readPinnedIds(storageKey: string): string[] {
  if (!storageKey) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, 40) : [];
  } catch { return []; }
}
