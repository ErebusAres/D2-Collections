import type { DistortionData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Clock3, Database, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, QueryState } from "../components/common/Page";
import { api } from "../services/api/client";
import styles from "./WorldState.module.css";

type Range = "24h" | "7d" | "30d" | "all";

export function DistortionsPage() {
  const [range, setRange] = useState<Range>("7d");
  const [now, setNow] = useState(() => Date.now());
  const result = useQuery({
    queryKey: ["distortions", range],
    queryFn: () => api<DistortionData>(`/api/v1/distortions?range=${range}`),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });
  const data = result.data?.data;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!data?.nextHourlyChangeAt) return;
    const delay = Math.max(0, Date.parse(data.nextHourlyChangeAt) - Date.now()) + 1_000;
    const timer = window.setTimeout(() => void result.refetch(), delay);
    return () => window.clearTimeout(timer);
  }, [data?.nextHourlyChangeAt, result.refetch]);
  return <>
    <PageHeader eyebrow="IX field intelligence" title="Distortion Tracker" description="Verified current state, observed history, and cautious pattern analysis for Destiny’s hourly destination Distortions." />
    <QueryState loading={result.isLoading} error={result.error as Error | null} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.distortionHero} data-state={data.state}>
        <div className={styles.distortionMark}><Waves /></div>
        <div><span>Current Distortion</span><h2>{data.current?.destination || "Location unavailable"}</h2><p>{data.current ? `Last verified ${new Date(data.current.lastConfirmedAt).toLocaleString()}` : "Guardian Nexus does not yet have a verified active-destination provider or recent manual observation."}</p></div>
        <div className={styles.distortionTimer}><Clock3 /><span>Next hourly change</span><strong>{formatDistortionCountdown(data.nextHourlyChangeAt, now)}</strong><small>{new Date(data.nextHourlyChangeAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div>
        <footer><b>{data.state.replace("-", " ")}</b><span>{data.sourceConfidence.replace("-", " ")} · {data.sourceLabel}</span>{data.lastSuccessfulUpdateAt && <time>Last success {new Date(data.lastSuccessfulUpdateAt).toLocaleString()}</time>}</footer>
      </section>
      <section className={styles.prediction} data-state={data.prediction.state}>
        <AlertTriangle /><div><span>Pattern analysis</span><h3>{data.prediction.state.replaceAll("-", " ")}</h3><p>{data.prediction.explanation}</p></div><b>{data.prediction.sampleSize} observations</b>
      </section>
      <section className={styles.statsGrid}>
        <Stat icon={<Database />} label="Observations" value={data.statistics.observations} />
        <Stat icon={<BarChart3 />} label="Most observed" value={data.statistics.mostCommonDestination || "Insufficient data"} />
        <Stat icon={<Clock3 />} label="Average interval" value={data.statistics.averageIntervalMinutes ? `${data.statistics.averageIntervalMinutes} min` : "Insufficient data"} />
        <Stat icon={<Waves />} label="Consecutive repeats" value={data.statistics.consecutiveRepeats} />
      </section>
      <section className={styles.history}>
        <header><div><span>Observed history</span><h2>Distortion timeline</h2></div><nav aria-label="History range">{(["24h", "7d", "30d", "all"] as Range[]).map((value) => <button key={value} className={range === value ? styles.selected : ""} onClick={() => setRange(value)}>{value}</button>)}</nav></header>
        {data.history.length ? <div className={styles.tableWrap}><table><thead><tr><th>Destination</th><th>Observed start</th><th>Observed end</th><th>Duration</th><th>Source</th><th>Confidence</th></tr></thead><tbody>
          {data.history.map((entry) => <tr key={entry.id}><td><strong>{entry.destination}</strong></td><td>{new Date(entry.observedStartAt).toLocaleString()}</td><td>{entry.observedEndAt ? new Date(entry.observedEndAt).toLocaleString() : "Active / incomplete"}</td><td>{entry.observedEndAt ? duration(entry.observedStartAt, entry.observedEndAt) : "—"}</td><td>{entry.source}</td><td><b>{entry.confidence.replace("-", " ")}</b></td></tr>)}
        </tbody></table></div> : <div className={styles.emptyHistory}><Waves /><h3>No observations recorded</h3><p>The scheduled collector is ready, but it will not invent a destination until a reliable provider or approved observation is available.</p></div>}
      </section>
    </>}
  </>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <article>{icon}<span>{label}</span><strong>{value}</strong></article>;
}
export function formatDistortionCountdown(value: string, now = Date.now()): string {
  const ms = Math.max(0, Date.parse(value) - now);
  return `${Math.floor(ms / 60_000)}m ${String(Math.floor(ms % 60_000 / 1_000)).padStart(2, "0")}s`;
}
function duration(start: string, end: string): string { const minutes = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60_000)); return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
