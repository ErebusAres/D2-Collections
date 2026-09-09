import { useEffect } from "react";
import { AuthGate, QueryState } from "../components/common/Page";
import {
  FIRETEAM_BUNGIE_DATA_NOTICE,
  FireteamDataNotice
} from "../components/fireteam/FireteamDataNotice";
import { FireteamRecentLootSection } from "../components/fireteam/FireteamRecentLootSection";
import { FireteamRoster } from "../components/fireteam/FireteamRoster";
import { FireteamSharingHeader } from "../components/fireteam/FireteamSharingHeader";
import { useFireteamCommandClipboard } from "../components/fireteam/useFireteamCommandClipboard";
import { useFireteamTrackedCollections } from "../components/fireteam/useFireteamTrackedCollections";
import { useFireteamTrackedItemOrder } from "../components/fireteam/useFireteamTrackedItemOrder";
import { useFireteamTrackedItemRemoval } from "../components/fireteam/useFireteamTrackedItemRemoval";
import { useFireteamViewPreferences } from "../components/fireteam/useFireteamViewPreferences";
import { useGuardian } from "../context/GuardianContext";
import { primeCompletionAudio } from "../services/completionAudio";
import styles from "./Pages.module.css";

import { FireteamActivityFeed } from "../components/fireteam/FireteamActivityFeed";
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
  const {
    pinnedQuestStorageKey,
    pinnedQuestIds,
    setPinnedQuestIds,
    trackedGuardianRankIds,
    setTrackedGuardianRankIds,
    trackedJourneyIds,
    trackedCollectionIds,
    trackedBuilds
  } = useFireteamTrackedCollections({
    membershipId,
    characterId: selectedCharacterId,
    savedGuardianRankTracking: preferences["guardianRank.tracked"],
    savedJourneyTracking: preferences["journey.tracked"],
    savedCollectionTracking: preferences["collection.tracked"],
    savedBuildTracking: preferences["buildAdvisor.trackedBuilds.v1"]
  });
  const {
    activityFeedView,
    activityFeedIsVisible,
    activityFeedStorageKey,
    recentLootIsVisible,
    changeActivityFeedView,
    hideRecentLoot,
    showRecentLoot
  } = useFireteamViewPreferences({
    membershipId,
    savedActivityFeedView: preferences["fireteam.activityFeedView.v1"],
    savedRecentLootVisibility: preferences["fireteam.recentLoot.v1"],
    savePreference: setPreference
  });
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
    recentLootIsVisible,
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
    feedIsVisible: activityFeedIsVisible,
    autoRefresh,
    csrfToken: session?.csrfToken,
    snapshotActivityFeed: data?.activityFeed,
    snapshotActivityFeedEnabled: data?.activityFeedEnabled
  });
  const hiddenTrackedItemKeys = data?.hiddenTrackedItemKeys || [];
  const {
    updateFireteamSharing,
    stopFireteamSharing,
    sharingUpdatePending,
    stopSharingPending,
    updatingUntrackingItemKey
  } = useFireteamSharing({
    characterId: selectedCharacterId,
    csrfToken: session?.csrfToken,
    currentPinnedQuestIds: pinnedQuestIds,
    currentTrackedGuardianRankIds: trackedGuardianRankIds,
    currentTrackedJourneyIds: trackedJourneyIds,
    currentTrackedCollectionIds: trackedCollectionIds,
    currentTrackedBuilds: trackedBuilds,
    currentHiddenTrackedItemKeys: hiddenTrackedItemKeys
  });
  const {
    removeTrackedItem,
    removingTrackedItemKey
  } = useFireteamTrackedItemRemoval({
    sharingMode: data?.sharingMode,
    pinnedQuestStorageKey,
    currentPinnedQuestIds: pinnedQuestIds,
    setPinnedQuestIds,
    currentTrackedGuardianRankIds: trackedGuardianRankIds,
    setTrackedGuardianRankIds,
    currentTrackedJourneyIds: trackedJourneyIds,
    currentTrackedCollectionIds: trackedCollectionIds,
    currentTrackedBuilds: trackedBuilds,
    currentHiddenTrackedItemKeys: hiddenTrackedItemKeys,
    savePreference: setPreference,
    updateSharedTrackedItems: updateFireteamSharing
  });
  const self = data?.members.find((member) => member.isSelf);
  const { trackedItemOrder, reorderTrackedItems } = useFireteamTrackedItemOrder({
    currentGuardian: self,
    membershipId,
    characterId: selectedCharacterId,
    savedTrackedItemOrder: preferences["fireteam.trackedOrder"],
    setPreference
  });
  const {
    copiedCommandIdentifier,
    copyCommand
  } = useFireteamCommandClipboard();
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
      isVisible={recentLootIsVisible}
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
      onHide={hideRecentLoot}
      onShow={showRecentLoot}
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
      copiedCommandIdentifier={copiedCommandIdentifier}
      onCopyCommand={copyCommand}
      onUntrackCurrentGuardianItem={removeTrackedItem}
      currentGuardianTrackedItemOrder={trackedItemOrder}
      onReorderCurrentGuardianTrackedItem={reorderTrackedItems}
      currentGuardianUntrackingItemKey={removingTrackedItemKey || updatingUntrackingItemKey}
    />}
    {session?.authenticated && <FireteamActivityFeed
      feed={displayedActivityFeed}
      view={activityFeedView}
      storageKey={activityFeedStorageKey}
      onViewChange={changeActivityFeedView}
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
