import type { DistortionData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Clock3, Database, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader, QueryState } from "../components/common/Page";
import { api } from "../services/api/client";
import styles from "./WorldState.module.css";

type Range = "24h" | "7d" | "30d" | "all";
export const DISTORTION_DESTINATION_ROTATION = [
  "EDZ",
  "Dreaming City",
  "Savathûn's Throne World",
  "Moon",
  "Europa",
  "Nessus",
  "Cosmodrome"
] as const;
type DistortionDestination = typeof DISTORTION_DESTINATION_ROTATION[number];

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
  const activeDestination = canonicalDistortionDestination(data?.current?.destination);
  const expectedDestination = canonicalDistortionDestination(data?.prediction.expectedDestination);
  const destinationRotation = rotateDistortionDestinations(data?.current?.destination);

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
        <header>
          <AlertTriangle />
          <div><span>Pattern analysis</span><h3>Destination rotation</h3><p>{data.prediction.explanation}</p></div>
          <b>{data.prediction.state.replaceAll("-", " ")} · {data.prediction.sampleSize} observations</b>
        </header>
        <div className={styles.distortionRotationViewport}>
          <ol className={styles.distortionRotation} aria-label="Distortion destination rotation">
            {destinationRotation.map((destination, index) => {
              const active = destination === activeDestination;
              const expected = destination === expectedDestination && !active;
              return <li key={destination} data-active={active} data-expected={expected}>
                <i aria-hidden="true"><span /></i>
                <small>{active ? "Current / active" : activeDestination && index === 1 ? "Next in rotation" : `Rotation +${index}`}</small>
                <strong>{destination}</strong>
                {expected && <em>Expected</em>}
              </li>;
            })}
          </ol>
        </div>
        <footer><span>Current destination stays leftmost</span><b>Distortion red → corruption black</b></footer>
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
export function canonicalDistortionDestination(value?: string): DistortionDestination | undefined {
  const normalized = normalizeDestination(value);
  if (!normalized) return undefined;
  if (normalized === "edz" || normalized.includes("european dead zone")) return "EDZ";
  if (normalized.includes("dreaming city")) return "Dreaming City";
  if (normalized.includes("throne world")) return "Savathûn's Throne World";
  if (normalized === "moon" || normalized === "the moon") return "Moon";
  if (normalized.includes("europa")) return "Europa";
  if (normalized.includes("nessus")) return "Nessus";
  if (normalized.includes("cosmodrome")) return "Cosmodrome";
  return undefined;
}

export function rotateDistortionDestinations(currentDestination?: string): DistortionDestination[] {
  const current = canonicalDistortionDestination(currentDestination);
  if (!current) return [...DISTORTION_DESTINATION_ROTATION];
  const currentIndex = DISTORTION_DESTINATION_ROTATION.indexOf(current);
  return [
    ...DISTORTION_DESTINATION_ROTATION.slice(currentIndex),
    ...DISTORTION_DESTINATION_ROTATION.slice(0, currentIndex)
  ];
}

function normalizeDestination(value?: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function formatDistortionCountdown(value: string, now = Date.now()): string {
  const ms = Math.max(0, Date.parse(value) - now);
  return `${Math.floor(ms / 60_000)}m ${String(Math.floor(ms % 60_000 / 1_000)).padStart(2, "0")}s`;
}
function duration(start: string, end: string): string { const minutes = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60_000)); return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
