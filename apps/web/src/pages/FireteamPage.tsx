import type { FireteamData, FireteamMember, FireteamSharingMode, FireteamTrackedItem, GearActionRequest, GearActionResult, GearTag, LootWatcherConfig, LootWatcherRunResult, RecentItemTimelineData, UserPreferenceKey } from "@guardian-nexus/contracts";
import { catalystTrackingId } from "@guardian-nexus/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Crown, EyeOff, Link2, MessageSquare, Repeat2, Share2, Timer, UserMinus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { FireteamTrackedItem as FireteamTrackedItemComponent } from "../components/fireteam/FireteamTrackedItem";
import {
  fireteamCompletionEventKey,
  fireteamMemberPresenceLocation,
  fireteamTrackedItemKey,
  legacyQuestToFireteamTrackedItem,
  orderedFireteamTrackedItemKeys,
  orderFireteamTrackedItems
} from "../components/fireteam/fireteamTrackedItems";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { playCompletionChime, primeCompletionAudio } from "../services/completionAudio";
import { parseTrackedBuilds } from "../modules/buildAdvisor/buildTracking";
import styles from "./Pages.module.css";

import { CompactRecentLootBar, type LootItem } from "../components/gear/RecentLoot";
import { FireteamActivityFeed, type FireteamActivityFeedView } from "../components/fireteam/FireteamActivityFeed";
import { useFireteamQuery } from "../modules/fireteam/useFireteamQuery";
import { FIRETEAM_ACTIVITY_REFRESH_INTERVAL_MS, LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";

const BUNGIE_PRESENCE_DISCLAIMER = "Fireteam membership and activity come from Bungie and may take a few minutes to catch up.";

interface ShareVariables {
  mode: FireteamSharingMode;
  sitePinnedQuestIds?: string[];
  siteTrackedGuardianRankIds?: string[];
  siteTrackedJourneyIds?: string[];
  siteTrackedCollectionIds?: string[];
  siteTrackedBuilds?: FireteamTrackedItem[];
  hiddenTrackedItemKeys?: string[];
  activityFeedEnabled?: boolean;
  untrackingKey?: string;
}

const TRACKED_ITEM_EXIT_MS = 1_600;
const LOOT_WATCHER_PREFERENCES: Record<keyof LootWatcherConfig, UserPreferenceKey> = {
  farmingMode: "fireteam.watcher.farming.v1",
  highestPowerLock: "fireteam.watcher.highestPower.v1",
  tier5FitLock: "fireteam.watcher.tier5Fits.v1",
  duplicateFitJunk: "fireteam.watcher.duplicateFits.v1"
};
function updateFireteamCachedTag(value: unknown, itemInstanceId: string, tag?: GearTag): unknown {
  if (!value || typeof value !== "object") return value;
  const root = value as any; const data = root.data;
  if (!data || !Array.isArray(data.events)) return value;
  return { ...root, data: { ...data, events: data.events.map((event: any) => event.gear?.instanceId === itemInstanceId ? { ...event, gear: { ...event.gear, tag } } : event) } };
}
function watcherResultLabel(result: LootWatcherRunResult): string {
  const actions = [
    result.movedToVault.length ? `${result.movedToVault.length} moved` : "",
    result.locked.length ? `${result.locked.length} locked` : "",
    result.taggedJunk.length ? `${result.taggedJunk.length} tagged junk` : ""
  ].filter(Boolean);
  if (result.warnings[0]) return actions.length ? `${actions.join(" · ")} · ${result.warnings[0]}` : result.warnings[0];
  if (result.skipped[0] && !actions.length) return result.skipped[0];
  return actions.length ? actions.join(" · ") : "Watcher settings saved.";
}
export function FireteamPage() {
  const { session, selectedCharacterId, preferences, setPreference, autoRefresh } = useGuardian();
  const queryClient = useQueryClient();
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
  const lootWatchers = useMemo<LootWatcherConfig>(() => ({
    farmingMode: preferences[LOOT_WATCHER_PREFERENCES.farmingMode] === "on",
    highestPowerLock: preferences[LOOT_WATCHER_PREFERENCES.highestPowerLock] === "on",
    tier5FitLock: preferences[LOOT_WATCHER_PREFERENCES.tier5FitLock] === "on",
    duplicateFitJunk: preferences[LOOT_WATCHER_PREFERENCES.duplicateFitJunk] === "on"
  }), [preferences]);
  const recentItems = useQuery({
    queryKey: ["fireteam-recent-items", selectedCharacterId],
    queryFn: () => api<RecentItemTimelineData>(`/api/v2/fireteam/recent-items?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId && showRecentLoot),
    staleTime: LIVE_REFRESH_INTERVAL_MS,
    // Recent Loot is written by the canonical five-minute Fireteam snapshot.
    // FireteamRoute refetches this active query only after a newer snapshot
    // commits, so minute polling cannot discover additional saved data.
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
  const activityFeed = useQuery({
    queryKey: ["fireteam-activity", session?.guardian?.membershipId, selectedCharacterId],
    queryFn: () => api<NonNullable<FireteamData["activityFeed"]>>("/api/v2/fireteam/activity"),
    enabled: Boolean(session?.authenticated && activityFeedView !== "hidden"),
    staleTime: FIRETEAM_ACTIVITY_REFRESH_INTERVAL_MS,
    refetchInterval: autoRefresh ? FIRETEAM_ACTIVITY_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const gearState = useMutation({ mutationFn: (input: { itemInstanceId: string; tag?: GearTag | null }) => queuedApi("/api/v1/me/gear/item-state", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }, { persist: true }), onMutate: async (input) => { const queryKey = ["fireteam-recent-items", selectedCharacterId] as const; await queryClient.cancelQueries({ queryKey }); const previous = queryClient.getQueryData(queryKey); queryClient.setQueryData(queryKey, (value: unknown) => updateFireteamCachedTag(value, input.itemInstanceId, input.tag || undefined)); return { queryKey, previous }; }, onError: (_error, _input, context) => queryClient.setQueryData(context?.queryKey || ["fireteam-recent-items", selectedCharacterId], context?.previous), onSettled: () => void queryClient.invalidateQueries({ queryKey: ["fireteam-recent-items", selectedCharacterId] }) });
  const gearAction = useMutation({ mutationFn: async (input: GearActionRequest) => { const response = await api<GearActionResult>("/api/v1/me/gear/action", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }); if (response.data.failed[0]) throw new Error(response.data.failed[0].message); return response; }, onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ["fireteam-recent-items", selectedCharacterId] }), queryClient.invalidateQueries({ queryKey: ["gear", selectedCharacterId] })]) });
  const watcherRun = useMutation({
    mutationFn: (config: LootWatcherConfig) => api<LootWatcherRunResult>("/api/v2/fireteam/loot-watchers/run", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: selectedCharacterId, config }) }),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ["fireteam-recent-items", selectedCharacterId] }), queryClient.invalidateQueries({ queryKey: ["gear", selectedCharacterId] })])
  });
  const toggleLootWatcher = (key: keyof LootWatcherConfig, enabled: boolean) => {
    const next = { ...lootWatchers, [key]: enabled };
    setPreference(LOOT_WATCHER_PREFERENCES[key], enabled ? "on" : "off");
    watcherRun.mutate(next);
  };
  const watcherStatus = watcherRun.isPending
    ? "Updating watchers…"
    : watcherRun.error instanceof Error
      ? watcherRun.error.message
      : watcherRun.data
        ? watcherResultLabel(watcherRun.data.data)
        : undefined;
  const tagRecent = (item: LootItem, tag?: GearTag) => gearState.mutate({ itemInstanceId: item.instanceId, tag: tag || null });
  const preferenceTrackedItemOrder = useMemo(() => trackedPreference(preferences["fireteam.trackedOrder"]), [preferences]);
  const [trackedItemOrder, setTrackedItemOrder] = useState(preferenceTrackedItemOrder);
  useEffect(() => setTrackedItemOrder(preferenceTrackedItemOrder), [preferences["fireteam.trackedOrder"]]);
  const hiddenTrackedItemKeys = data?.hiddenTrackedItemKeys || [];
  const [manualRemovingKey, setManualRemovingKey] = useState("");
  const share = useMutation({
    mutationFn: ({ mode, sitePinnedQuestIds = pinnedIds, siteTrackedGuardianRankIds = guardianRankIds, siteTrackedJourneyIds = journeyIds, siteTrackedCollectionIds = collectionIds, siteTrackedBuilds = trackedBuilds, hiddenTrackedItemKeys: hiddenKeys = hiddenTrackedItemKeys, activityFeedEnabled }: ShareVariables) => queuedApi("/api/v2/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: selectedCharacterId, sitePinnedQuestIds, siteTrackedGuardianRankIds, siteTrackedJourneyIds, siteTrackedCollectionIds, siteTrackedBuilds, hiddenTrackedItemKeys: hiddenKeys, ...(activityFeedEnabled === undefined ? {} : { activityFeedEnabled }), mode }) }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["fireteam"] }),
      queryClient.invalidateQueries({ queryKey: ["fireteam-activity"] })
    ])
  });
  const stop = useMutation({
    mutationFn: () => queuedApi("/api/v2/fireteam/share", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["fireteam"] }),
      queryClient.invalidateQueries({ queryKey: ["fireteam-activity"] })
    ])
  });
  const sendMessage = useMutation({
    mutationFn: (body: string) => queuedApi("/api/v2/fireteam/messages", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ body }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam-activity"] })
  });
  const liveActivityFeed = activityFeed.data?.data && Array.isArray(activityFeed.data.data.entries) ? activityFeed.data.data : data?.activityFeed;
  const visibleActivityFeed = liveActivityFeed || {
    enabled: Boolean(data?.activityFeedEnabled),
    channelAvailable: false,
    entries: [],
    historyLimit: 60,
    retentionDays: 7,
    messageMaxLength: 240
  };
  const sharingMode = data?.sharingMode;
  const self = data?.members.find((member) => member.isSelf);
  const trackedOrderContext = `${membershipId}:${selectedCharacterId}`;
  const previousTrackedOrderKeys = useRef<{ context: string; keys: Set<string> } | undefined>(undefined);
  const selfTrackedItems = self ? (Array.isArray(self.trackedItems) ? self.trackedItems : self.quests.map(legacyQuestToFireteamTrackedItem)) : [];
  const selfTrackedSignature = selfTrackedItems.map(fireteamTrackedItemKey).sort().join("|");
  useEffect(() => {
    if (!self) return;
    const currentKeys = new Set(selfTrackedItems.map(fireteamTrackedItemKey));
    const previous = previousTrackedOrderKeys.current;
    previousTrackedOrderKeys.current = { context: trackedOrderContext, keys: currentKeys };
    if (!previous || previous.context !== trackedOrderContext) {
      if (!trackedItemOrder.length && currentKeys.size) {
        const initialOrder = [...currentKeys];
        setTrackedItemOrder(initialOrder);
        setPreference("fireteam.trackedOrder", JSON.stringify(initialOrder));
      }
      return;
    }
    const addedKeys = [...currentKeys].filter((key) => !previous.keys.has(key));
    if (!addedKeys.length) return;
    const nextOrder = [...addedKeys, ...orderedFireteamTrackedItemKeys(selfTrackedItems, trackedItemOrder).filter((key) => !addedKeys.includes(key))];
    setTrackedItemOrder(nextOrder);
    setPreference("fireteam.trackedOrder", JSON.stringify(nextOrder));
  }, [selfTrackedSignature, trackedOrderContext]);
  const reorderTrackedItems = (sourceKey: string, targetKey: string) => {
    if (!self || sourceKey === targetKey) return;
    const sourceItems = Array.isArray(self.trackedItems) ? self.trackedItems : self.quests.map(legacyQuestToFireteamTrackedItem);
    const nextOrder = orderedFireteamTrackedItemKeys(sourceItems, trackedItemOrder);
    const sourceIndex = nextOrder.indexOf(sourceKey);
    const targetIndex = nextOrder.indexOf(targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;
    nextOrder.splice(targetIndex, 0, nextOrder.splice(sourceIndex, 1)[0]!);
    setTrackedItemOrder(nextOrder);
    setPreference("fireteam.trackedOrder", JSON.stringify(nextOrder));
  };
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
      share.mutate({
        mode: sharingMode,
        sitePinnedQuestIds: nextPinnedIds,
        siteTrackedGuardianRankIds: nextGuardianRankIds,
        siteTrackedJourneyIds: nextJourneyIds,
        siteTrackedCollectionIds: nextCollectionIds,
        siteTrackedBuilds: nextTrackedBuilds,
        hiddenTrackedItemKeys: hiddenKeys,
        untrackingKey: key
      }, { onSettled: () => setManualRemovingKey((current) => current === key ? "" : current) });
    }, TRACKED_ITEM_EXIT_MS);
  };

  return <AuthGate>
    <div className={styles.fireteamUpper}>
    <PageHeader eyebrow="Your current team" title="Fireteam" description="See who is in your fireteam, the goals they share, and your recent loot. Updates automatically every five minutes." actions={<>
      <Freshness observedAt={data?.pageUpdatedAt} label="Last updated" warning={result.data?.warnings.find((warning) => warning !== BUNGIE_PRESENCE_DISCLAIMER)} />
      {data && !data.sharingEnabled && <>
        <button className={styles.primaryAction} onClick={() => share.mutate({ mode: "temporary" })} disabled={share.isPending}><Timer size={15} />Share 15 minutes</button>
        <button className={styles.primaryAction} onClick={() => share.mutate({ mode: "persistent" })} disabled={share.isPending}><Repeat2 size={15} />Always share</button>
      </>}
      {data?.sharingEnabled && <>
        {data.sharingMode === "temporary" && <button className={styles.primaryAction} onClick={() => share.mutate({ mode: "persistent" })} disabled={share.isPending}><Repeat2 size={15} />Make automatic</button>}
        <button className={`${styles.primaryAction} ${styles.sharing}`} onClick={() => stop.mutate()} disabled={stop.isPending}><Share2 size={15} />Stop sharing</button>
      </>}
    </>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {showRecentLoot ? <CompactRecentLootBar events={recentItems.data?.data.events || []} loading={recentItems.isLoading} error={recentItems.error as Error | null} warnings={recentItems.data?.warnings} retentionDays={recentItems.data?.data.retentionDays} observedAt={recentItems.data?.data.observedAt} firstObservationEstablished={recentItems.data?.data.firstObservationEstablished} onRetry={() => void recentItems.refetch()} onTag={tagRecent} onPull={(item) => gearAction.mutate({ action: "transfer", itemInstanceId: item.instanceId, target: "character", targetCharacterId: selectedCharacterId })} onSocketChange={(item, socketIndex, plugItemHash) => gearAction.mutate({ action: "setWeaponSocket", itemInstanceId: item.instanceId, characterId: selectedCharacterId, socketIndex, plugItemHash })} busy={gearState.isPending || gearAction.isPending} onHide={() => setPreference("fireteam.recentLoot.v1", "off")} watchers={lootWatchers} onWatcherChange={toggleLootWatcher} watcherBusy={watcherRun.isPending} watcherStatus={watcherStatus} /> : <section className={styles.fireteamLootControl}><div><strong>Recent Loot hidden</strong><small>Loot tracking stays active while this section is hidden.</small></div><button onClick={() => setPreference("fireteam.recentLoot.v1", "on")}>Show Recent Loot</button></section>}
    {(gearState.error || gearAction.error) && <div className={styles.gearError}>{(gearState.error || gearAction.error)?.message}</div>}
    </div>
    {data && <>
      <section className={styles.fireteamGrid}>{data.members.map((member) => <MemberCard key={member.membershipId} member={member} canManage={Boolean(self?.isLeader && !member.isSelf)} copied={copied} onCopy={copyCommand} onUntrack={member.isSelf ? untrackItem : undefined} itemOrder={member.isSelf ? trackedItemOrder : undefined} onReorder={member.isSelf ? reorderTrackedItems : undefined} untrackingKey={member.isSelf ? manualRemovingKey || (share.isPending ? share.variables?.untrackingKey : undefined) : undefined} />)}</section>
    </>}
    {session?.authenticated && <FireteamActivityFeed feed={visibleActivityFeed} view={activityFeedView} storageKey={`guardian-nexus:fireteam-activity-window:${session?.guardian?.membershipId || "guest"}`} onViewChange={(view) => setPreference("fireteam.activityFeedView.v1", view)} onSend={(body) => sendMessage.mutate(body)} sending={sendMessage.isPending} error={sendMessage.error instanceof Error ? sendMessage.error.message : activityFeed.error instanceof Error ? activityFeed.error.message : undefined} onDisable={() => data?.sharingMode && data.sharingMode !== "off" && share.mutate({ mode: data.sharingMode, activityFeedEnabled: false })} onEnable={() => data?.sharingMode && data.sharingMode !== "off" && share.mutate({ mode: data.sharingMode, activityFeedEnabled: true })} />}
    {data && <footer className={styles.fireteamDataNote}><AlertTriangle /><span>{BUNGIE_PRESENCE_DISCLAIMER}</span></footer>}
  </AuthGate>;
}

function MemberCard({ member, canManage, copied, onCopy, onUntrack, itemOrder, onReorder, untrackingKey }: { member: FireteamMember; canManage: boolean; copied: string; onCopy: (label: string, command: string) => Promise<void>; onUntrack?: (item: FireteamTrackedItem) => void; itemOrder?: string[]; onReorder?: (sourceKey: string, targetKey: string) => void; untrackingKey?: string }) {
  const activity = fireteamMemberPresenceLocation(member);
  const trackedItems = Array.isArray(member.trackedItems) ? member.trackedItems : member.quests.map(legacyQuestToFireteamTrackedItem);
  const trackedItemKeys = trackedItems.map(fireteamTrackedItemKey);
  const trackedItemSignature = [...trackedItemKeys].sort().join("|");
  const previousTrackedItemKeys = useRef<Set<string> | null>(null);
  const previousTrackedItems = useRef<Map<string, FireteamTrackedItem>>(new Map());
  const entryTimers = useRef<Map<string, number>>(new Map());
  const removalTimers = useRef<Map<string, number>>(new Map());
  const [enteringKeys, setEnteringKeys] = useState<Set<string>>(() => new Set());
  const [removedItems, setRemovedItems] = useState<Map<string, FireteamTrackedItem>>(() => new Map());
  const completedKeys = new Set((member.recentlyCompletedItems || []).map(fireteamTrackedItemKey));
  useEffect(() => {
    const currentKeys = new Set(trackedItemKeys);
    const previousKeys = previousTrackedItemKeys.current;
    previousTrackedItemKeys.current = currentKeys;
    const currentItems = new Map(trackedItems.map((item) => [fireteamTrackedItemKey(item), item]));
    const priorItems = previousTrackedItems.current;
    previousTrackedItems.current = currentItems;
    if (!previousKeys) return;

    const addedKeys = [...currentKeys].filter((key) => !previousKeys.has(key));
    if (addedKeys.length) setEnteringKeys((current) => new Set([...current, ...addedKeys]));
    for (const key of addedKeys) {
      const existingTimer = entryTimers.current.get(key);
      if (existingTimer) window.clearTimeout(existingTimer);
      const timer = window.setTimeout(() => {
        setEnteringKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        entryTimers.current.delete(key);
      }, 1_400);
      entryTimers.current.set(key, timer);
    }
    const removed = [...previousKeys]
      .filter((key) => !currentKeys.has(key) && !completedKeys.has(key))
      .map((key) => [key, priorItems.get(key)] as const)
      .filter((entry): entry is readonly [string, FireteamTrackedItem] => Boolean(entry[1]));
    if (removed.length) {
      setRemovedItems((current) => new Map([...current, ...removed]));
      for (const [key] of removed) {
        const existingTimer = removalTimers.current.get(key);
        if (existingTimer) window.clearTimeout(existingTimer);
        const timer = window.setTimeout(() => {
          setRemovedItems((current) => {
            const next = new Map(current);
            next.delete(key);
            return next;
          });
          removalTimers.current.delete(key);
        }, TRACKED_ITEM_EXIT_MS);
        removalTimers.current.set(key, timer);
      }
    }
  }, [trackedItemSignature, member.recentlyCompletedItems]);
  useEffect(() => () => {
    for (const timer of entryTimers.current.values()) window.clearTimeout(timer);
    entryTimers.current.clear();
    for (const timer of removalTimers.current.values()) window.clearTimeout(timer);
    removalTimers.current.clear();
  }, []);
  const recentlyCompletedItems = member.recentlyCompletedItems || [];
  const completedItemKeys = new Set(recentlyCompletedItems.map(fireteamTrackedItemKey));
  const completedItemSignature = [...completedItemKeys].sort().join("|");
  useEffect(() => {
    if (!completedItemKeys.size) return;
    setRemovedItems((current) => {
      const next = new Map(current);
      let changed = false;
      for (const key of completedItemKeys) {
        if (next.delete(key)) changed = true;
        const timer = removalTimers.current.get(key);
        if (timer) {
          window.clearTimeout(timer);
          removalTimers.current.delete(key);
        }
      }
      return changed ? next : current;
    });
  }, [completedItemSignature]);
  const [dismissedCompletions, setDismissedCompletions] = useState<Set<string>>(() => readDismissedCompletionEvents(member.membershipId));
  const visibleCompletions = recentlyCompletedItems.filter((item) => !dismissedCompletions.has(fireteamCompletionEventKey(item)));
  const visibleCompletionKeys = visibleCompletions.map(fireteamCompletionEventKey).join("|");
  useEffect(() => {
    if (!visibleCompletionKeys) return;
    const keys = visibleCompletionKeys.split("|");
    playCompletionChime();
    const timer = window.setTimeout(() => {
      setDismissedCompletions((current) => {
        const next = new Set([...current, ...keys]);
        writeDismissedCompletionEvents(member.membershipId, next);
        return next;
      });
    }, 1_600);
    return () => window.clearTimeout(timer);
  }, [member.membershipId, visibleCompletionKeys]);
  const completingKeys = new Set(visibleCompletions.map(fireteamTrackedItemKey));
  const orderedTrackedItems = orderFireteamTrackedItems(trackedItems, itemOrder);
  const visibleRemovedItems = [...removedItems.values()].filter((item) => !completedItemKeys.has(fireteamTrackedItemKey(item)));
  const displayedItems = [...orderedTrackedItems.filter((item) => !completingKeys.has(fireteamTrackedItemKey(item))), ...visibleCompletions, ...visibleRemovedItems];
  const activeItems = displayedItems.filter((item) => !("completedAt" in item) && !removedItems.has(fireteamTrackedItemKey(item)));
  const [draggingKey, setDraggingKey] = useState("");
  const [dragOverKey, setDragOverKey] = useState("");
  const finishDrag = () => {
    setDraggingKey("");
    setDragOverKey("");
  };
  const onlineLabel = member.onlineState === "unknown" ? "" : ` / ${member.onlineState === "online" ? "Online" : "Offline"}`;
  const syncLabel = member.syncState === "synced"
    ? member.sharingMode === "persistent" ? "Auto synced" : "Synced"
    : member.syncState === "delayed" ? "Sync delayed" : "Not synced";
  const untrackingIsCompletion = Boolean(untrackingKey && completedItemKeys.has(untrackingKey));
  const cardEvent = visibleCompletions.length ? "completed" : (!untrackingIsCompletion && untrackingKey) || visibleRemovedItems.length ? "removed" : enteringKeys.size ? "added" : "idle";
  return <article className={`${styles.memberCard} ${member.isSelf ? styles.selfMember : ""} ${cardEvent === "completed" ? styles.memberCardCompleted : cardEvent === "removed" ? styles.memberCardRemoved : cardEvent === "added" ? styles.memberCardAdded : ""}`} data-tracking-event={cardEvent}>
    <header>{member.emblemPath ? <img src={member.emblemPath} alt="" /> : <span><Users /></span>}<div><small>{member.isSelf ? `You · ${member.presenceLabel}` : member.presenceLabel}{onlineLabel} · {syncLabel}</small><h2>{member.inGameName}</h2><p>{member.character ? `${member.character.className} · ${member.character.power} Power` : "Character details unavailable"}</p></div><div className={styles.memberSignals}>{member.isLeader && <Crown aria-label="Fireteam leader" />}<i className={member.sharing ? styles.signalLive : ""} /></div></header>
    <div className={styles.memberActivity}><Activity size={15} /><span>{member.onlineState === "offline" ? "Presence" : member.activitySource === "shared" ? "Shared activity" : "Location"}</span><strong>{activity}</strong></div>
    {member.sharing ? <div className={styles.sharedQuests}><h3>{member.sharingMode === "persistent" ? "Automatically shared tracked items" : "Shared tracked items"}</h3>{displayedItems.length ? displayedItems.map((item) => {
      const key = fireteamTrackedItemKey(item);
      const transient = "completedAt" in item || removedItems.has(key);
      const activeIndex = activeItems.findIndex((candidate) => fireteamTrackedItemKey(candidate) === key);
      return <FireteamTrackedItemComponent key={key} trackedItem={item} isEntering={enteringKeys.has(key)} isCompleting={"completedAt" in item} onUntrack={onUntrack} isUntracking={untrackingKey === key || removedItems.has(key)} isReorderable={Boolean(onReorder && !transient)} isDragging={draggingKey === key} isDragTarget={dragOverKey === key && draggingKey !== key} onDragStart={() => setDraggingKey(key)} onDragOver={() => setDragOverKey(key)} onDrop={() => {
        if (draggingKey && draggingKey !== key) onReorder?.(draggingKey, key);
        finishDrag();
      }} onDragEnd={finishDrag} onMove={(direction) => {
        const target = activeItems[activeIndex + direction];
        if (target) onReorder?.(key, fireteamTrackedItemKey(target));
      }} onMoveToEdge={(edge) => {
        const target = edge === "top" ? activeItems[0] : activeItems[activeItems.length - 1];
        if (target && fireteamTrackedItemKey(target) !== key) onReorder?.(key, fireteamTrackedItemKey(target));
      }} isFirst={activeIndex === 0} isLast={activeIndex === activeItems.length - 1} />;
    }) : <p>{member.syncState === "delayed" ? "Updating shared progress…" : "Nothing is currently tracked."}</p>}</div> : <div className={styles.privateMember}><EyeOff /><strong>Tracked goals are private</strong><p>This Guardian has not shared their tracked goals.</p></div>}
    {!member.isSelf && <div className={styles.memberCommands}><button onClick={() => void onCopy(`whisper-${member.membershipId}`, `/whisper ${member.inGameName} `)} title="Copies a Destiny 2 text-chat command"><MessageSquare size={13} />{copied === `whisper-${member.membershipId}` ? "Copied" : "Whisper"}</button>{canManage && <button className={styles.managementCommand} onClick={() => void onCopy(`kick-${member.membershipId}`, `/kick ${member.inGameName}`)} title="Copies a Destiny 2 text-chat command; Guardian Nexus cannot kick through the Bungie API"><UserMinus size={13} />{copied === `kick-${member.membershipId}` ? "Copied" : "Kick command"}</button>}</div>}
    {member.overlaps.length > 0 && <footer><Link2 size={13} /><span>You can work on this together:</span><strong>{member.overlaps.join(", ")}</strong></footer>}
  </article>;
}

function readDismissedCompletionEvents(membershipId: string): Set<string> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(completionDismissalStorageKey(membershipId)) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(-100) : []);
  } catch {
    return new Set();
  }
}

function writeDismissedCompletionEvents(membershipId: string, values: ReadonlySet<string>): void {
  try {
    sessionStorage.setItem(completionDismissalStorageKey(membershipId), JSON.stringify([...values].slice(-100)));
  } catch {
    // The current card still dismisses the event when browser storage is unavailable.
  }
}

function completionDismissalStorageKey(membershipId: string): string {
  return `guardian-nexus:fireteam-completions:${membershipId}`;
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
