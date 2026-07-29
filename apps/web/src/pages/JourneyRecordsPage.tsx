import type { JourneyProgressData, JourneyRecord, JourneyTitle } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, CheckCircle2, Crown, ScrollText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./JourneyRecordsPage.module.css";

export function JourneyRecordsPage({ kind }: { kind: "titles" | "triumphs" }) {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "tracked" | "near" | "complete">("all");
  const tracked = useMemo(() => parseTracked(preferences["journey.tracked"]), [preferences]);
  const result = useQuery({
    queryKey: ["journey-progress", selectedCharacterId],
    queryFn: () => api<JourneyProgressData>(`/api/v1/me/journey?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const titles = kind === "titles";
  const sourceRows = titles ? result.data?.data.titles || [] : result.data?.data.triumphs || [];
  useEffect(() => {
    if (!result.data) return;
    const complete = new Set([...result.data.data.titles, ...result.data.data.triumphs, ...result.data.data.seasonalChallenges].filter((record) => record.complete).map((record) => record.recordHash));
    const next = [...tracked].filter((id) => !complete.has(id));
    if (next.length !== tracked.size) setPreference("journey.tracked", JSON.stringify(next));
  }, [result.data, setPreference, tracked]);
  const rows = sourceRows.filter((record) => {
    const id = record.recordHash;
    const matches = !search || `${record.name} ${"title" in record ? record.title : ""} ${record.description}`.toLowerCase().includes(search.toLowerCase());
    return matches && (filter === "all" || filter === "tracked" && tracked.has(id) || filter === "near" && record.percent >= 75 && !record.complete || filter === "complete" && record.complete);
  });
  const toggle = (id: string) => {
    const next = new Set(tracked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPreference("journey.tracked", JSON.stringify([...next]));
  };
  const Icon = titles ? Crown : ScrollText;
  return <AuthGate>
    <PageHeader eyebrow="Journey · Long-term progression" title={titles ? "Titles & Seals" : "Triumphs"} description={titles ? "Track seals and see which titles are closest to completion." : "Browse, filter, and track account Triumph progress."} actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <JourneyNav />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      <section className={styles.metrics}>
        <span><small>{titles ? "Titles" : "Triumphs"}</small><strong>{sourceRows.length}</strong></span>
        <span><small>Completed</small><strong>{sourceRows.filter((record) => record.complete).length}</strong></span>
        <span><small>Tracked here</small><strong>{sourceRows.filter((record) => tracked.has(record.recordHash)).length}</strong></span>
        {!titles && <span><small>Active score</small><strong>{result.data.data.triumphScore.active.toLocaleString()}</strong></span>}
      </section>
      <section className={styles.command}>
        <label><Search /><input type="search" data-page-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${titles ? "titles and seals" : "Triumphs"}…`} /></label>
        <div>{(["all", "tracked", "near", "complete"] as const).map((value) => <button key={value} className={filter === value ? styles.active : ""} onClick={() => setFilter(value)}>{value}</button>)}</div>
        <output>{rows.length} shown</output>
      </section>
      <section className={styles.grid}>{rows.length ? rows.map((record) => <RecordCard key={record.recordHash} record={record} titleMode={titles} tracked={tracked.has(record.recordHash)} onTrack={() => toggle(record.recordHash)} />) : <div className={styles.empty}><Icon /><h2>No matching progress</h2><p>Change the filter or search terms.</p></div>}</section>
    </>}
  </AuthGate>;
}

function RecordCard({ record, titleMode, tracked, onTrack }: { record: JourneyRecord | JourneyTitle; titleMode: boolean; tracked: boolean; onTrack: () => void }) {
  const title = titleMode && "title" in record ? record.title : record.name;
  return <article className={`${styles.card} ${record.complete ? styles.complete : ""}`}>
    <header><span>{record.icon ? <img src={record.icon} alt="" /> : record.complete ? <CheckCircle2 /> : titleMode ? <Crown /> : <ScrollText />}</span><div><small>{record.complete ? "Complete" : `${record.percent}% complete`}</small><h2>{title}</h2>{titleMode && title !== record.name && <p>{record.name}</p>}</div><button className={tracked ? styles.tracked : ""} onClick={onTrack} disabled={record.complete} title={record.complete ? "Completed items do not need tracking" : tracked ? "Stop tracking" : "Track on Fireteam"} aria-label={record.complete ? `${title} is complete` : tracked ? `Stop tracking ${title}` : `Track ${title} on Fireteam`}><Bookmark fill={tracked ? "currentColor" : "none"} /></button></header>
    <p>{record.description}</p>
    <i><span style={{ width: `${record.percent}%` }} /></i>
    <footer>{record.objectives.slice(0, 2).map((objective) => <span key={objective.objectiveHash}><small>{objective.name}</small><strong>{objective.complete ? "Complete" : `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}`}</strong></span>)}</footer>
  </article>;
}

function parseTracked(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []); }
  catch { return new Set(); }
}
