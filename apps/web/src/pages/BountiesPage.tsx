import type { QuestData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CheckCircle2, CheckSquare2, Clock3, Crosshair, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { pinsKey, useGuardian } from "../context/GuardianContext";
import { bountyCadence, bountyVendor, pursuitExpiryLabel, pursuitProgressLabel, questPercent } from "../modules/journey/progressSummary";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function BountiesPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const [filter, setFilter] = useState<"all" | "bounty" | "order" | "expiring">("all");
  const storageKey = pinsKey(session?.guardian?.membershipId || "", selectedCharacterId);
  const [pins, setPins] = useState<Set<string>>(new Set());
  useEffect(() => { try { setPins(new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"))); } catch { setPins(new Set()); } }, [storageKey]);
  const togglePin = (id: string) => setPins((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    localStorage.setItem(storageKey, JSON.stringify([...next]));
    return next;
  });
  const result = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const bounties = (result.data?.data.quests || []).filter((quest) => quest.category === "bounty" || quest.category === "order");
  const visible = useMemo(() => bounties.filter((quest) =>
    filter === "all"
    || filter === quest.category
    || filter === "expiring" && Boolean(quest.expiresAt)
  ).sort((left, right) => Number(right.inGameTracked) - Number(left.inGameTracked) || right.percent - left.percent || left.name.localeCompare(right.name)), [bounties, filter]);
  const vendors = new Map<string, number>();
  for (const bounty of bounties) vendors.set(bountyVendor(bounty), (vendors.get(bountyVendor(bounty)) || 0) + 1);

  return <AuthGate>
    <PageHeader eyebrow="Journey · Short-term objectives" title="Bounties" description="Active bounties and orders grouped from your selected character." actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      <section className={styles.metrics}>
        <span><small>Active</small><strong>{bounties.length}</strong></span>
        <span><small>Hub orders</small><strong>{bounties.filter((quest) => quest.category === "order").length}</strong></span>
        <span><small>Daily</small><strong>{bounties.filter((quest) => bountyCadence(quest) === "daily").length}</strong></span>
        <span><small>Weekly</small><strong>{bounties.filter((quest) => bountyCadence(quest) === "weekly").length}</strong></span>
        <span><small>Completion</small><strong>{questPercent(bounties)}%</strong></span>
      </section>
      {vendors.size > 0 && <section className={styles.vendorStrip}>{[...vendors].sort(([left], [right]) => left.localeCompare(right)).map(([vendor, count]) => <span key={vendor}><small>{vendor}</small><strong>{count}</strong></span>)}</section>}
      <section className={styles.filterStrip} aria-label="Bounty filters"><Filter />{(["all", "bounty", "order", "expiring"] as const).map((value) => <button key={value} className={filter === value ? styles.activeFilter : ""} onClick={() => setFilter(value)}>{value === "all" ? "All pursuits" : value === "bounty" ? "Bounties" : value === "order" ? "Hub orders" : "Expiring"}</button>)}<span>{visible.length} shown</span></section>
      <section className={styles.rows}>
        {visible.length ? visible.map((bounty) => <Link key={bounty.instanceId} to={`/quests/${encodeURIComponent(bounty.instanceId)}`} className={styles.row}>
          <span className={styles.rowIcon}>{bounty.icon ? <img src={bounty.icon} alt="" /> : <CheckSquare2 />}</span>
          <div><small>{bountyVendor(bounty)} · {bountyCadence(bounty)} {bounty.category}{pursuitExpiryLabel(bounty.expiresAt) ? ` · ${pursuitExpiryLabel(bounty.expiresAt)}` : ""}</small><h2>{bounty.name}</h2><p>{bounty.currentStep || bounty.description}</p>{bounty.objectives.length > 0 && <i><span style={{ width: `${bounty.percent}%` }} /></i>}</div>
          <aside>{bounty.inGameTracked && <em><Crosshair /> Tracked</em>}<strong>{pursuitProgressLabel(bounty)}</strong>{bounty.percent >= 100 ? <CheckCircle2 /> : <Clock3 />}<button onClick={(event) => { event.preventDefault(); togglePin(bounty.instanceId); }} disabled={bounty.percent >= 100} aria-label={`${pins.has(bounty.instanceId) ? "Untrack" : "Track"} ${bounty.name}`}><Bookmark fill={pins.has(bounty.instanceId) ? "currentColor" : "none"} /></button></aside>
        </Link>) : <div className={styles.empty}><CheckSquare2 /><h2>{bounties.length ? "No pursuits match this filter" : "No active bounties or orders"}</h2><p>{bounties.length ? "Choose another filter to see active pursuits." : "Bungie returned no bounty or order pursuits for this character."}</p></div>}
      </section>
    </>}
  </AuthGate>;
}
