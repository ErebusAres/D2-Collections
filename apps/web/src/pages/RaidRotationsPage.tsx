import type { RaidRotationsData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Clock3, RefreshCcw, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, QueryState } from "../components/common/Page";
import { formatUtcAndLocalTime } from "../modules/time";
import { api } from "../services/api/client";
import { formatResetCountdown, WorldCard } from "./WhatsHappeningPage";
import styles from "./WorldState.module.css";

export function RaidRotationsPage() {
  const result = useQuery({
    queryKey: ["raid-rotations"],
    queryFn: () => api<RaidRotationsData>("/api/v1/world/raids"),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return <>
    <PageHeader
      eyebrow="This week's raids"
      title="Raid Rotations"
      description="See this week's raid challenges and active rotation details."
      actions={<button className={styles.refresh} onClick={() => void result.refetch()}><RefreshCcw /> Refresh rotations</button>}
    />
    <QueryState loading={result.isLoading} error={result.error as Error | null} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      <section className={styles.activityHero}>
        <Swords />
        <div><span>Active raid entries</span><strong>{result.data.data.cards.length}</strong><small>Reported by Bungie public milestones</small></div>
        <Clock3 />
        <div><span>Weekly reset in</span><strong>{formatResetCountdown(result.data.data.nextWeeklyResetAt, now)}</strong><small>{formatUtcAndLocalTime(result.data.data.nextWeeklyResetAt)}</small></div>
      </section>
      {result.data.data.cards.length
        ? <section className={styles.raidGrid}>{result.data.data.cards.map((card) => <WorldCard key={card.id} card={card} now={now} />)}</section>
        : <section className={styles.emptyHistory}><Swords /><h3>Raid rotations unavailable</h3><p>Bungie is not currently providing raid challenge details. Check again after the next weekly reset or data refresh.</p></section>}
    </>}
  </>;
}
