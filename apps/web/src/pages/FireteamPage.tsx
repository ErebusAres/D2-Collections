import type { FireteamCompletedTrackedItem, FireteamContact, FireteamData, FireteamMember, FireteamSharingMode, FireteamSocialData, FireteamTrackedItem, GearTag, RecentItemTimelineData } from "@guardian-nexus/contracts";
import { catalystTrackingId } from "@guardian-nexus/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpToLine, BookmarkMinus, CheckCircle2, Copy, Crown, EyeOff, GripVertical, Link2, LogIn, MessageSquare, Repeat2, Share2, Timer, UserMinus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { playCompletionChime, primeCompletionAudio } from "../services/completionAudio";
import { parseTrackedBuilds } from "../modules/buildAdvisor/buildTracking";
import styles from "./Pages.module.css";
import { CompactRecentLootBar, type LootItem } from "../components/gear/RecentLoot";
import { FireteamActivityFeed, type FireteamActivityFeedView } from "../components/fireteam/FireteamActivityFeed";
import { ObjectiveRequirementText } from "../components/quests/ObjectiveRequirementText";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";

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
export function FireteamPage() {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const queryClient = useQueryClient();
  const result = useQuery({
    queryKey: ["fireteam", selectedCharacterId],
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated),
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
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
  const showRecentLoot = preferences["fireteam.recentLoot.v1"] !== "off";
  const recentItems = useQuery({
    queryKey: ["recent-items", selectedCharacterId],
    queryFn: () => api<RecentItemTimelineData>(`/api/v1/me/recent-items?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false
  });
  const activityFeed = useQuery({
    queryKey: ["fireteam-activity", selectedCharacterId],
    queryFn: () => api<NonNullable<FireteamData["activityFeed"]>>("/api/v1/fireteam/activity"),
    enabled: Boolean(session?.authenticated),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false
  });
  const social = useQuery({
    queryKey: ["fireteam-social"],
    queryFn: () => api<FireteamSocialData>("/api/v1/fireteam/social"),
    enabled: Boolean(session?.authenticated),
    staleTime: 10 * 60_000,
    refetchInterval: false
  });
  const gearState = useMutation({ mutationFn: (input: { itemInstanceId: string; tag?: GearTag | null }) => queuedApi("/api/v1/me/gear/item-state", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }, { persist: true }), onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["recent-items", selectedCharacterId] }) });
  const tagRecent = (item: LootItem, tag?: GearTag) => gearState.mutate({ itemInstanceId: item.instanceId, tag: tag || null });
  const preferenceTrackedItemOrder = useMemo(() => trackedPreference(preferences["fireteam.trackedOrder"]), [preferences]);
  const [trackedItemOrder, setTrackedItemOrder] = useState(preferenceTrackedItemOrder);
  useEffect(() => setTrackedItemOrder(preferenceTrackedItemOrder), [preferences["fireteam.trackedOrder"]]);
  const hiddenTrackedItemKeys = data?.hiddenTrackedItemKeys || [];
  const activityFeedView = parseActivityFeedView(preferences["fireteam.activityFeedView.v1"]);
  const [manualRemovingKey, setManualRemovingKey] = useState("");
  const share = useMutation({
    mutationFn: ({ mode, sitePinnedQuestIds = pinnedIds, siteTrackedGuardianRankIds = guardianRankIds, siteTrackedJourneyIds = journeyIds, siteTrackedCollectionIds = collectionIds, siteTrackedBuilds = trackedBuilds, hiddenTrackedItemKeys: hiddenKeys = hiddenTrackedItemKeys, activityFeedEnabled }: ShareVariables) => queuedApi("/api/v1/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: selectedCharacterId, sitePinnedQuestIds, siteTrackedGuardianRankIds, siteTrackedJourneyIds, siteTrackedCollectionIds, siteTrackedBuilds, hiddenTrackedItemKeys: hiddenKeys, ...(activityFeedEnabled === undefined ? {} : { activityFeedEnabled }), mode }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
  });
  const stop = useMutation({
    mutationFn: () => queuedApi("/api/v1/fireteam/share", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
  });
  const sendMessage = useMutation({
    mutationFn: (body: string) => queuedApi("/api/v1/fireteam/messages", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ body }) }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["fireteam"] }); void queryClient.invalidateQueries({ queryKey: ["fireteam-activity"] }); }
  });
  const liveActivityFeed = activityFeed.data?.data && Array.isArray(activityFeed.data.data.entries) ? activityFeed.data.data : data?.activityFeed;
  const socialData = social.data?.data || data?.social;
  const sharingMode = data?.sharingMode;
  const self = data?.members.find((member) => member.isSelf);
  const trackedOrderContext = `${membershipId}:${selectedCharacterId}`;
  const previousTrackedOrderKeys = useRef<{ context: string; keys: Set<string> } | undefined>(undefined);
  const selfTrackedItems = self ? (Array.isArray(self.trackedItems) ? self.trackedItems : self.quests.map(legacyTrackedItem)) : [];
  const selfTrackedSignature = selfTrackedItems.map(trackedItemKey).sort().join("|");
  useEffect(() => {
    if (!self) return;
    const currentKeys = new Set(selfTrackedItems.map(trackedItemKey));
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
    const nextOrder = [...addedKeys, ...orderedTrackedItemKeys(selfTrackedItems, trackedItemOrder).filter((key) => !addedKeys.includes(key))];
    setTrackedItemOrder(nextOrder);
    setPreference("fireteam.trackedOrder", JSON.stringify(nextOrder));
  }, [selfTrackedSignature, trackedOrderContext]);
  const reorderTrackedItems = (sourceKey: string, targetKey: string) => {
    if (!self || sourceKey === targetKey) return;
    const sourceItems = Array.isArray(self.trackedItems) ? self.trackedItems : self.quests.map(legacyTrackedItem);
    const nextOrder = orderedTrackedItemKeys(sourceItems, trackedItemOrder);
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
    const key = trackedItemKey(item);
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
    <PageHeader eyebrow="Cooperative intelligence" title="Fireteam" description="Shared progress refreshes every 60 seconds while auto-refresh is enabled." actions={<>
      <Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />
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
    {showRecentLoot ? <CompactRecentLootBar events={recentItems.data?.data.events || []} loading={recentItems.isLoading} error={recentItems.error as Error | null} warnings={recentItems.data?.warnings} retentionDays={recentItems.data?.data.retentionDays} observedAt={recentItems.data?.data.observedAt} firstObservationEstablished={recentItems.data?.data.firstObservationEstablished} onRetry={() => void recentItems.refetch()} onTag={tagRecent} busy={gearState.isPending} onHide={() => setPreference("fireteam.recentLoot.v1", "off")} /> : <section className={styles.fireteamLootControl}><div><strong>Recent account items hidden</strong><small>Observation continues privately while Guardian Nexus is open</small></div><button onClick={() => setPreference("fireteam.recentLoot.v1", "on")}>Show timeline</button></section>}
    {data && <>
      <section className={styles.fireteamGrid}>{data.members.map((member) => <MemberCard key={member.membershipId} member={member} canManage={Boolean(self?.isLeader && !member.isSelf)} copied={copied} onCopy={copyCommand} onUntrack={member.isSelf ? untrackItem : undefined} itemOrder={member.isSelf ? trackedItemOrder : undefined} onReorder={member.isSelf ? reorderTrackedItems : undefined} untrackingKey={member.isSelf ? manualRemovingKey || (share.isPending ? share.variables?.untrackingKey : undefined) : undefined} />)}</section>
      <section className={styles.transitoryNotice}><AlertTriangle /><div><strong>Status may be delayed</strong><p>Party presence and current activity are not guaranteed to be real time.</p></div></section>
    </>}
    {activityFeed.isError && !liveActivityFeed && <section className={styles.fireteamLootControl}><div><strong>Fireteam Activity is temporarily unavailable</strong><small>{activityFeed.error instanceof Error ? activityFeed.error.message : "This section can be retried independently."}</small></div><button onClick={() => void activityFeed.refetch()}>Retry Activity</button></section>}
    {liveActivityFeed && <FireteamActivityFeed feed={liveActivityFeed} view={activityFeedView} storageKey={`guardian-nexus:fireteam-activity-window:${session?.guardian?.membershipId || "guest"}`} onViewChange={(view) => setPreference("fireteam.activityFeedView.v1", view)} onSend={(body) => sendMessage.mutate(body)} sending={sendMessage.isPending} error={sendMessage.error instanceof Error ? sendMessage.error.message : undefined} onDisable={() => data?.sharingMode && data.sharingMode !== "off" && share.mutate({ mode: data.sharingMode, activityFeedEnabled: false })} onEnable={() => data?.sharingMode && data.sharingMode !== "off" && share.mutate({ mode: data.sharingMode, activityFeedEnabled: true })} />}
    <SocialRoster contacts={socialData?.contacts || []} friendsState={socialData?.friendsState || socialData?.state || "unavailable"} clanState={socialData?.clanState || (socialData?.state === "available" ? "available" : "unavailable")} warning={socialData?.warning || social.data?.warnings[0] || (social.error instanceof Error ? social.error.message : undefined)} copied={copied} onCopy={copyCommand} />
  </AuthGate>;
}

function MemberCard({ member, canManage, copied, onCopy, onUntrack, itemOrder, onReorder, untrackingKey }: { member: FireteamMember; canManage: boolean; copied: string; onCopy: (label: string, command: string) => Promise<void>; onUntrack?: (item: FireteamTrackedItem) => void; itemOrder?: string[]; onReorder?: (sourceKey: string, targetKey: string) => void; untrackingKey?: string }) {
  const activity = presenceLocation(member);
  const trackedItems = Array.isArray(member.trackedItems) ? member.trackedItems : member.quests.map(legacyTrackedItem);
  const trackedItemKeys = trackedItems.map(trackedItemKey);
  const trackedItemSignature = [...trackedItemKeys].sort().join("|");
  const previousTrackedItemKeys = useRef<Set<string> | null>(null);
  const previousTrackedItems = useRef<Map<string, FireteamTrackedItem>>(new Map());
  const entryTimers = useRef<Map<string, number>>(new Map());
  const removalTimers = useRef<Map<string, number>>(new Map());
  const [enteringKeys, setEnteringKeys] = useState<Set<string>>(() => new Set());
  const [removedItems, setRemovedItems] = useState<Map<string, FireteamTrackedItem>>(() => new Map());
  const completedKeys = new Set((member.recentlyCompletedItems || []).map(trackedItemKey));
  useEffect(() => {
    const currentKeys = new Set(trackedItemKeys);
    const previousKeys = previousTrackedItemKeys.current;
    previousTrackedItemKeys.current = currentKeys;
    const currentItems = new Map(trackedItems.map((item) => [trackedItemKey(item), item]));
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
  const completedItemKeys = new Set(recentlyCompletedItems.map(trackedItemKey));
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
  const visibleCompletions = recentlyCompletedItems.filter((item) => !dismissedCompletions.has(completionEventKey(item)));
  const visibleCompletionKeys = visibleCompletions.map(completionEventKey).join("|");
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
  const completingKeys = new Set(visibleCompletions.map(trackedItemKey));
  const orderedTrackedItems = orderTrackedItems(trackedItems, itemOrder);
  const visibleRemovedItems = [...removedItems.values()].filter((item) => !completedItemKeys.has(trackedItemKey(item)));
  const displayedItems = [...orderedTrackedItems.filter((item) => !completingKeys.has(trackedItemKey(item))), ...visibleCompletions, ...visibleRemovedItems];
  const activeItems = displayedItems.filter((item) => !("completedAt" in item) && !removedItems.has(trackedItemKey(item)));
  const [draggingKey, setDraggingKey] = useState("");
  const [dragOverKey, setDragOverKey] = useState("");
  const finishDrag = () => {
    setDraggingKey("");
    setDragOverKey("");
  };
  const onlineLabel = member.onlineState === "unknown" ? "" : ` / ${member.onlineState === "online" ? "Online" : "Offline"}`;
  const untrackingIsCompletion = Boolean(untrackingKey && completedItemKeys.has(untrackingKey));
  const cardEvent = visibleCompletions.length ? "completed" : (!untrackingIsCompletion && untrackingKey) || visibleRemovedItems.length ? "removed" : enteringKeys.size ? "added" : "idle";
  return <article className={`${styles.memberCard} ${member.isSelf ? styles.selfMember : ""} ${cardEvent === "completed" ? styles.memberCardCompleted : cardEvent === "removed" ? styles.memberCardRemoved : cardEvent === "added" ? styles.memberCardAdded : ""}`} data-tracking-event={cardEvent}>
    <header>{member.emblemPath ? <img src={member.emblemPath} alt="" /> : <span><Users /></span>}<div><small>IGN / {member.isSelf ? `You / ${member.presenceLabel}` : member.presenceLabel}{onlineLabel} / {member.syncState === "synced" ? member.sharingMode === "persistent" ? "Auto synced" : "Synced" : "Not synced"}</small><h2>{member.inGameName}</h2><p>{member.character ? `${member.character.className} / ${member.character.power} Power` : "Public Bungie fireteam profile"}</p></div><div className={styles.memberSignals}>{member.isLeader && <Crown aria-label="Fireteam leader" />}<i className={member.sharing ? styles.signalLive : ""} /></div></header>
    <div className={styles.memberActivity}><Activity size={15} /><span>{member.onlineState === "offline" ? "Presence" : member.activitySource === "public" ? "Public location" : member.activitySource === "shared" ? "Shared activity" : "Location"}</span><strong>{activity}</strong></div>
    {member.sharing ? <div className={styles.sharedQuests}><h3>{member.sharingMode === "persistent" ? "Automatically shared tracked items" : "Shared tracked items"}</h3>{displayedItems.length ? displayedItems.map((item) => {
      const key = trackedItemKey(item);
      const transient = "completedAt" in item || removedItems.has(key);
      const activeIndex = activeItems.findIndex((candidate) => trackedItemKey(candidate) === key);
      return <TrackedItem key={key} item={item} entering={enteringKeys.has(key)} completing={"completedAt" in item} onUntrack={onUntrack} untracking={untrackingKey === key || removedItems.has(key)} reorderable={Boolean(onReorder && !transient)} dragging={draggingKey === key} dragOver={dragOverKey === key && draggingKey !== key} onDragStart={() => setDraggingKey(key)} onDragOver={() => setDragOverKey(key)} onDrop={() => {
        if (draggingKey && draggingKey !== key) onReorder?.(draggingKey, key);
        finishDrag();
      }} onDragEnd={finishDrag} onMove={(direction) => {
        const target = activeItems[activeIndex + direction];
        if (target) onReorder?.(key, trackedItemKey(target));
      }} onMoveToEdge={(edge) => {
        const target = edge === "top" ? activeItems[0] : activeItems[activeItems.length - 1];
        if (target && trackedItemKey(target) !== key) onReorder?.(key, trackedItemKey(target));
      }} atTop={activeIndex === 0} atBottom={activeIndex === activeItems.length - 1} />;
    }) : <p>Nothing is currently tracked.</p>}</div> : <div className={styles.privateMember}><EyeOff /><strong>Tracked details not shared</strong><p>This Guardian must opt into temporary or automatic sharing.</p></div>}
    {!member.isSelf && <div className={styles.memberCommands}><button onClick={() => void onCopy(`whisper-${member.membershipId}`, `/whisper ${member.inGameName} `)} title="Copies a Destiny 2 text-chat command"><MessageSquare size={13} />{copied === `whisper-${member.membershipId}` ? "Copied" : "Whisper"}</button>{canManage && <button className={styles.managementCommand} onClick={() => void onCopy(`kick-${member.membershipId}`, `/kick ${member.inGameName}`)} title="Copies a Destiny 2 text-chat command; Guardian Nexus cannot kick through the Bungie API"><UserMinus size={13} />{copied === `kick-${member.membershipId}` ? "Copied" : "Kick command"}</button>}</div>}
    {member.overlaps.length > 0 && <footer><Link2 size={13} /><span>Shared progress opportunity:</span><strong>{member.overlaps.join(", ")}</strong></footer>}
  </article>;
}

function TrackedItem({ item, entering = false, completing = false, onUntrack, untracking = false, reorderable = false, dragging = false, dragOver = false, onDragStart, onDragOver, onDrop, onDragEnd, onMove, onMoveToEdge, atTop = false, atBottom = false }: { item: FireteamTrackedItem; entering?: boolean; completing?: boolean; onUntrack?: (item: FireteamTrackedItem) => void; untracking?: boolean; reorderable?: boolean; dragging?: boolean; dragOver?: boolean; onDragStart?: () => void; onDragOver?: () => void; onDrop?: () => void; onDragEnd?: () => void; onMove?: (direction: -1 | 1) => void; onMoveToEdge?: (edge: "top" | "bottom") => void; atTop?: boolean; atBottom?: boolean }) {
  const progressKnown = item.objectives.length === 0 || item.objectives.some((objective) => objective.progressAvailable);
  const manageable = Boolean(onUntrack && !completing);
  const untrackTitle = item.trackedInDestiny
    ? item.trackedInGuardianNexus ? "Untrack in Guardian Nexus and hide while Destiny still tracks it" : "Hide from Fireteam sharing until Destiny stops tracking it"
    : "Untrack in Guardian Nexus";
  const trackingState = completing ? "exiting" : entering ? "entering" : "active";
  const removing = untracking && !completing;
  return <div className={`${styles.sharedQuest} ${manageable ? styles.sharedQuestManageable : ""} ${reorderable ? styles.sharedQuestReorderable : ""} ${dragging ? styles.sharedQuestDragging : ""} ${dragOver ? styles.sharedQuestDragOver : ""} ${completing ? styles.sharedQuestCompleting : removing ? styles.sharedQuestRemoving : entering ? styles.sharedQuestEntering : ""}`} data-completion-state={completing ? "exiting" : "active"} data-tracking-state={removing ? "removing" : trackingState} onDragOver={reorderable ? (event) => { event.preventDefault(); onDragOver?.(); } : undefined} onDrop={reorderable ? (event) => { event.preventDefault(); onDrop?.(); } : undefined}>
    {reorderable && <button type="button" draggable className={styles.sharedQuestDragHandle} aria-label={`Reorder ${item.name}`} title="Drag to reorder" onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", trackedItemKey(item)); onDragStart?.(); }} onDragEnd={onDragEnd} onKeyDown={(event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      onMove?.(event.key === "ArrowUp" ? -1 : 1);
    }}><GripVertical /></button>}
    {completing && <span className={styles.sharedQuestCompletionFx} aria-hidden="true"><i /><b>{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</b><em><CheckCircle2 /></em></span>}
    <span className={styles.sharedQuestIcon}>{item.icon ? <img src={item.icon} alt="" /> : <CheckCircle2 />}</span>
    <div className={styles.sharedQuestDetails}>
      <div className={styles.sharedQuestTitle}><b>{item.name}</b><em>{item.context}</em></div>
      <small>{item.description}</small>
      {item.objectives.length > 0 && <div className={styles.sharedObjectives}>{item.objectives.map((objective) => <div key={objective.objectiveHash}><span><ObjectiveRequirementText value={objective.name} /></span><strong>{objective.complete ? "Complete" : !objective.progressAvailable ? "Unavailable" : objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : `${objective.percent}%`}</strong></div>)}</div>}
      {item.acquisitionGuide && <div className={styles.sharedAcquisitionGuide}><strong>How to get it</strong><p>{item.acquisitionGuide.summary}</p>{item.acquisitionGuide.steps.length > 0 && <ol>{item.acquisitionGuide.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}{item.acquisitionGuide.prerequisites.length > 0 && <><strong>Prerequisites</strong><ul>{item.acquisitionGuide.prerequisites.map((step, index) => <li key={index}>{step}</li>)}</ul></>}</div>}
      <i className={styles.sharedQuestBar}><span style={{ width: `${progressKnown ? item.percent : 0}%` }} /></i>
    </div>
    <strong className={styles.sharedQuestPercent}>{progressKnown ? `${item.percent}%` : "—"}</strong>
    {manageable && <div className={styles.sharedQuestActions}>
      {reorderable && <><button type="button" className={styles.sharedQuestMoveEdge} onClick={() => onMoveToEdge?.("top")} disabled={atTop || untracking} title="To top" aria-label={`Move ${item.name} to top`}><ArrowUpToLine /></button><button type="button" className={styles.sharedQuestMoveEdge} onClick={() => onMoveToEdge?.("bottom")} disabled={atBottom || untracking} title="To bottom" aria-label={`Move ${item.name} to bottom`}><ArrowDownToLine /></button></>}
      <button type="button" className={styles.sharedQuestUntrack} onClick={() => onUntrack?.(item)} disabled={untracking} title={untrackTitle} aria-label={`Untrack ${item.name} from Fireteam`}><BookmarkMinus /></button>
    </div>}
  </div>;
}

function trackedItemKey(item: Pick<FireteamTrackedItem, "kind" | "id">): string {
  return `${item.kind}:${item.id}`;
}

function orderedTrackedItemKeys(items: FireteamTrackedItem[], order: string[] = []): string[] {
  const available = new Set(items.map(trackedItemKey));
  const known = order.filter((key) => available.delete(key));
  return [...available, ...known];
}

function orderTrackedItems(items: FireteamTrackedItem[], order: string[] = []): FireteamTrackedItem[] {
  const byKey = new Map(items.map((item) => [trackedItemKey(item), item]));
  return orderedTrackedItemKeys(items, order).map((key) => byKey.get(key)!).filter(Boolean);
}

function completionEventKey(item: FireteamCompletedTrackedItem): string {
  return `${trackedItemKey(item)}:${item.completedAt}`;
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

function legacyTrackedItem(quest: FireteamMember["quests"][number]): FireteamTrackedItem {
  const kind = quest.category || "quest";
  const label = kind === "bounty" ? "Bounty" : kind === "order" ? "Order" : "Quest";
  return {
    id: quest.instanceId,
    definitionHash: quest.itemHash,
    kind,
    name: quest.name,
    description: quest.currentStep || quest.description,
    icon: quest.icon,
    context: quest.activityName ? `${label} · ${quest.activityName}` : label,
    trackedInDestiny: quest.inGameTracked,
    trackedInGuardianNexus: quest.sitePinned,
    objectives: quest.objectives.map((objective) => ({ ...objective, progressAvailable: true })),
    percent: quest.percent,
    updatedAt: quest.updatedAt
  };
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

function SocialRoster({ contacts, friendsState, clanState, warning, copied, onCopy }: { contacts: FireteamContact[]; friendsState: "available" | "reauthorization-required" | "unavailable"; clanState: "available" | "unavailable"; warning?: string; copied: string; onCopy: (label: string, command: string) => Promise<void> }) {
  const friends = contacts.filter((contact) => contact.source === "friend" || contact.source === "friend-and-clan");
  const clan = contacts.filter((contact) => contact.source === "clan" || contact.source === "friend-and-clan");
  return <section className={styles.socialRoster}>
    <header><div><Users /><span>Social roster</span><h2>Friends & clan</h2></div></header>
    <SocialGroup title="Bungie Friends" count={friends.length}>
      {friendsState === "reauthorization-required" ? <div className={styles.socialUnavailable}><AlertTriangle /><div><strong>Reconnect for Bungie friends</strong><p>{warning || "Bungie did not authorize access to the signed-in account's friend list."}</p></div><a href="/api/v1/auth/start?returnTo=%2Ffireteam">Reconnect Bungie</a></div>
        : friendsState === "unavailable" ? <div className={styles.socialUnavailable}><AlertTriangle /><div><strong>Bungie friends unavailable</strong><p>The friend-list request failed; clan members can still appear below.</p></div></div>
        : friends.length ? <div className={styles.socialGrid}>{friends.map((contact) => <SocialContact key={`friend-${contact.membershipId}-${contact.displayName}`} contact={contact} copied={copied} onCopy={onCopy} />)}</div>
        : <div className={styles.socialUnavailable}><Users /><div><strong>No Bungie friends returned</strong></div></div>}
    </SocialGroup>
    <SocialGroup title="Clan Members" count={clan.length}>
      {clanState === "unavailable" ? <div className={styles.socialUnavailable}><AlertTriangle /><div><strong>Clan roster unavailable</strong></div></div>
        : clan.length ? <div className={styles.socialGrid}>{clan.map((contact) => <SocialContact key={`clan-${contact.membershipId}-${contact.displayName}`} contact={contact} copied={copied} onCopy={onCopy} />)}</div>
        : <div className={styles.socialUnavailable}><Users /><div><strong>No clan members returned</strong><p>The signed-in Destiny membership may not currently belong to a clan.</p></div></div>}
    </SocialGroup>
  </section>;
}

function SocialGroup({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className={styles.socialGroup}><header><h3>{title}</h3><span>{count}</span></header>{children}</section>;
}

function SocialContact({ contact, copied, onCopy }: { contact: FireteamContact; copied: string; onCopy: (label: string, command: string) => Promise<void> }) {
  const id = contact.membershipId || contact.displayName;
  const online = contact.onlineState === "online";
  const canJoin = canJoinContact(contact);
  const joinTitle = contact.onlineState === "unknown" ? "Bungie did not provide a confirmed online state" : !canJoin ? "This Guardian is currently offline" : contact.inDestiny2 ? "Copies /join for Destiny 2 text chat" : "Copies /join; Bungie shows this Guardian online but does not identify their current title";
  return <article className={styles.socialContact}><i className={online ? styles.socialOnline : ""} /><div><span>{contact.source === "friend-and-clan" ? "Friend · Clan" : contact.source}{contact.clanName ? ` · ${contact.clanName}` : ""}</span><strong>{contact.displayName}</strong><small>{online ? contact.inDestiny2 ? "Online in Destiny 2" : "Online · title unavailable" : contact.onlineState === "offline" ? "Offline" : "Offline or presence hidden"}</small></div><div><button disabled={!canJoin} onClick={() => void onCopy(`join-${id}`, `/join ${contact.displayName}`)} title={joinTitle}><LogIn size={13} />{copied === `join-${id}` ? "Copied" : "Join Fireteam"}</button><button disabled={!online} onClick={() => void onCopy(`friend-whisper-${id}`, `/whisper ${contact.displayName} `)} title="Copies /whisper for Destiny 2 text chat"><MessageSquare size={13} />{copied === `friend-whisper-${id}` ? "Copied" : "Whisper"}</button><button onClick={() => void onCopy(`name-${id}`, contact.displayName)} title="Copy Bungie Name"><Copy size={13} /></button></div></article>;
}

function presenceLocation(member: Pick<FireteamMember, "onlineState" | "activity"> | undefined, fallback?: string): string {
  if (member?.onlineState === "offline") return "Offline";
  if (member?.activity) return member.activity;
  if (fallback) return fallback;
  return member?.onlineState === "online" ? "Online · location unavailable" : "Presence unavailable";
}

export function canJoinContact(contact: Pick<FireteamContact, "onlineState">): boolean {
  return contact.onlineState === "online";
}
