import type { JourneyProgressData, QuestData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CheckCircle2, Crown, Crosshair, Shield, Sparkles, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { bountyCadence, questPercent } from "../modules/journey/progressSummary";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function SeasonalPage() {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const tracked = useMemo(() => parseTracked(preferences["journey.tracked"]), [preferences]);
  const storageKey = pinsKey(session?.guardian?.membershipId || "", selectedCharacterId);
  const [pins, setPins] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { setPins(new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"))); }
    catch { setPins(new Set()); }
  }, [storageKey]);
  const enabled = Boolean(session?.authenticated && selectedCharacterId);
  const quests = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const journey = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const orders = (quests.data?.data.quests || []).filter((quest) => quest.category === "order");
  const objectives = journey.data?.data.weeklyChallenges || [];
  const alerts = objectives.filter((challenge) => /vanguard|alert|raid|dungeon|crucible/i.test(`${challenge.name} ${challenge.description}`));
  const conquests = objectives.filter((challenge) => /conquest/i.test(`${challenge.name} ${challenge.description}`));
  const seasonalTitle = journey.data?.data.titles.find((title) => /conqueror/i.test(`${title.title} ${title.name}`));
  const completedOrders = orders.filter((order) => order.percent >= 100).length;
  const dailyOrders = orders.filter((order) => bountyCadence(order) === "daily").length;
  const weeklyOrders = orders.filter((order) => bountyCadence(order) === "weekly").length;
  const toggleJourney = (id: string) => {
    const next = new Set(tracked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPreference("journey.tracked", JSON.stringify([...next]));
  };
  const toggleOrder = (id: string) => setPins((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    localStorage.setItem(storageKey, JSON.stringify([...next]));
    return next;
  });

  return <AuthGate>
    <PageHeader eyebrow="Journey · Portal Ops" title="Seasonal Hub" description="Daily and weekly objectives, Orders, Vanguard Alerts, Conquests, and Seasonal Title progress." actions={<Freshness observedAt={journey.data?.freshness.observedAt || quests.data?.freshness.observedAt} warning={journey.data?.warnings[0] || quests.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={quests.isLoading || journey.isLoading} error={(quests.error || journey.error) as Error} hasData={Boolean(quests.data || journey.data)} onRetry={() => { void quests.refetch(); void journey.refetch(); }} />
    {(journey.data || quests.data) && <>
      <section className={styles.seasonHero}>
        <div><Sparkles /><span><small>Seasonal Hub overview</small><h2>Weekly Progress</h2></span></div>
        <strong>{completedOrders}<small>Orders complete</small></strong>
        <div className={styles.seasonProgress}><span><small>Active Order progress</small><b>{orders.length ? `${questPercent(orders)}%` : "No active Orders"}</b></span><i><span style={{ width: `${questPercent(orders)}%` }} /></i><p>{dailyOrders} daily · {weeklyOrders} weekly · {Math.max(0, orders.length - completedOrders)} remaining</p></div>
      </section>
      <section className={styles.featureGrid}>
        <article><Crosshair /><span><small>Challenges Hub</small><strong>{orders.length} active Orders</strong><p>{dailyOrders} daily and {weeklyOrders} weekly objectives</p></span></article>
        <article><Shield /><span><small>Vanguard Alerts</small><strong>{alerts.length} available</strong><p>{alerts.filter((challenge) => challenge.objective.complete).length} completed</p></span></article>
        <article><Swords /><span><small>Conquests</small><strong>{conquests.length} available</strong><p>{conquests.filter((challenge) => challenge.objective.complete).length} completed</p></span></article>
        <article><Crown /><span><small>Seasonal Title</small><strong>{seasonalTitle?.title || "Conqueror"}</strong><p>{seasonalTitle ? `${seasonalTitle.percent}% complete` : "No title progress returned"}</p></span></article>
      </section>
      <section className={styles.rows}>
        {orders.map((order) => <Link key={order.instanceId} to={`/quests/${encodeURIComponent(order.instanceId)}`} className={styles.row}>
          <span className={styles.rowIcon}>{order.icon ? <img src={order.icon} alt="" /> : <Crosshair />}</span>
          <div><small>{bountyCadence(order)} Order</small><h2>{order.name}</h2><p>{order.currentStep || order.description}</p><i><span style={{ width: `${order.percent}%` }} /></i></div>
          <aside>{order.inGameTracked && <em><Crosshair /> Tracked</em>}<strong>{order.percent}%</strong>{order.percent >= 100 && <CheckCircle2 />}<button onClick={(event) => { event.preventDefault(); toggleOrder(order.instanceId); }} disabled={order.percent >= 100} aria-label={`${pins.has(order.instanceId) ? "Untrack" : "Track"} ${order.name}`}><Bookmark fill={pins.has(order.instanceId) ? "currentColor" : "none"} /></button></aside>
        </Link>)}
        {objectives.map((challenge) => <article key={challenge.id} className={styles.row}>
          <span className={styles.rowIcon}>{challenge.icon ? <img src={challenge.icon} alt="" /> : <Shield />}</span>
          <div><small>{conquests.includes(challenge) ? "Conquest" : alerts.includes(challenge) ? "Vanguard Alert" : "Weekly objective"}</small><h2>{challenge.name}</h2><p>{challenge.description}</p><i><span style={{ width: `${challenge.objective.percent}%` }} /></i></div>
          <aside><strong>{challenge.objective.percent}%</strong>{challenge.objective.complete && <CheckCircle2 />}<button onClick={() => toggleJourney(challenge.id)} disabled={challenge.objective.complete} aria-label={`${tracked.has(challenge.id) ? "Untrack" : "Track"} ${challenge.name}`}><Bookmark fill={tracked.has(challenge.id) ? "currentColor" : "none"} /></button></aside>
        </article>)}
        {seasonalTitle && <article className={styles.row}>
          <span className={styles.rowIcon}>{seasonalTitle.icon ? <img src={seasonalTitle.icon} alt="" /> : <Crown />}</span>
          <div><small>Seasonal Title</small><h2>{seasonalTitle.title}</h2><p>{seasonalTitle.description}</p><i><span style={{ width: `${seasonalTitle.percent}%` }} /></i></div>
          <aside><strong>{seasonalTitle.percent}%</strong>{seasonalTitle.complete && <CheckCircle2 />}<button onClick={() => toggleJourney(seasonalTitle.recordHash)} disabled={seasonalTitle.complete} aria-label={`${tracked.has(seasonalTitle.recordHash) ? "Untrack" : "Track"} ${seasonalTitle.title}`}><Bookmark fill={tracked.has(seasonalTitle.recordHash) ? "currentColor" : "none"} /></button></aside>
        </article>}
        {!orders.length && !objectives.length && !seasonalTitle && <div className={styles.empty}><Sparkles /><h2>No active Seasonal Hub objectives</h2><p>No current Orders, alerts, Conquests, or Seasonal Title progress were returned for this character.</p></div>}
      </section>
    </>}
  </AuthGate>;
}

function parseTracked(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []); }
  catch { return new Set(); }
}
