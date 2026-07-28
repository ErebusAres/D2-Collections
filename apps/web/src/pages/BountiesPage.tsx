import type { QuestData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CheckSquare2, Clock3, Crosshair } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { bountyCadence, bountyVendor, questPercent } from "../modules/journey/progressSummary";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyTrackers.module.css";

export function BountiesPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const result = useQuery({
    queryKey: ["quests", selectedCharacterId, ""],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const bounties = (result.data?.data.quests || []).filter((quest) => quest.category === "bounty" || quest.category === "order");
  const vendors = new Map<string, number>();
  for (const bounty of bounties) vendors.set(bountyVendor(bounty), (vendors.get(bountyVendor(bounty)) || 0) + 1);

  return <AuthGate>
    <PageHeader eyebrow="Journey · Short-term objectives" title="Bounties" description="Active bounties and orders grouped from your selected character." actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      <section className={styles.metrics}>
        <span><small>Active</small><strong>{bounties.length}</strong></span>
        <span><small>Daily</small><strong>{bounties.filter((quest) => bountyCadence(quest) === "daily").length}</strong></span>
        <span><small>Weekly</small><strong>{bounties.filter((quest) => bountyCadence(quest) === "weekly").length}</strong></span>
        <span><small>Seasonal</small><strong>{bounties.filter((quest) => bountyCadence(quest) === "seasonal").length}</strong></span>
        <span><small>Completion</small><strong>{questPercent(bounties)}%</strong></span>
      </section>
      {vendors.size > 0 && <section className={styles.vendorStrip}>{[...vendors].sort(([left], [right]) => left.localeCompare(right)).map(([vendor, count]) => <span key={vendor}><small>{vendor}</small><strong>{count}</strong></span>)}</section>}
      <section className={styles.rows}>
        {bounties.length ? bounties.sort((left, right) => Number(right.inGameTracked) - Number(left.inGameTracked) || right.percent - left.percent).map((bounty) => <Link key={bounty.instanceId} to={`/quests/${encodeURIComponent(bounty.instanceId)}`} className={styles.row}>
          <span className={styles.rowIcon}>{bounty.icon ? <img src={bounty.icon} alt="" /> : <CheckSquare2 />}</span>
          <div><small>{bountyVendor(bounty)} · {bountyCadence(bounty)} {bounty.category}</small><h2>{bounty.name}</h2><p>{bounty.currentStep || bounty.description}</p><i><span style={{ width: `${bounty.percent}%` }} /></i></div>
          <aside>{bounty.inGameTracked && <em><Crosshair /> Tracked</em>}<strong>{bounty.percent}%</strong>{bounty.percent >= 100 ? <CheckCircle2 /> : <Clock3 />}</aside>
        </Link>) : <div className={styles.empty}><CheckSquare2 /><h2>No active bounties or orders</h2><p>Bungie returned no bounty-category pursuits for this character.</p></div>}
      </section>
    </>}
  </AuthGate>;
}
