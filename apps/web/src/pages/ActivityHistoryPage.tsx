import type { ActivityHistoryData, ActivityHistoryEntry, ActivityHistoryKind } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, Clock3, History, ShieldQuestion, Swords, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import guide from "../assets/data/onboarding-guide.v1.json";
import { api } from "../services/api/client";
import styles from "./ActivityHistoryPage.module.css";

type HistoryFilter = "all" | ActivityHistoryKind;

export function ActivityHistoryPage() {
  const { session, autoRefresh } = useGuardian();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const result = useQuery({
    queryKey: ["activity-history"], queryFn: () => api<ActivityHistoryData>("/api/v1/me/activity-history"),
    enabled: Boolean(session?.authenticated), staleTime: 60_000, refetchInterval: autoRefresh ? 60_000 : false, refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  const rows = useMemo(() => (data?.activities || []).filter((entry) => filter === "all" || entry.kind === filter), [data, filter]);
  const completed = data?.activities.filter((entry) => entry.completed).length || 0;

  return <AuthGate>
    <JourneyNav />
    <PageHeader eyebrow="Recent activity" title="Activity history" description="Review activities across all your characters. If Bungie does not provide part of the history, the gap is shown clearly." actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.summary} data-state={data.state}><History /><div><span>Bungie activity result</span><h2>{data.activities.length} recent activities</h2><p>{historyState(data)}</p></div><dl><div><dt>Completed</dt><dd>{completed}</dd></div><div><dt>Characters</dt><dd>{data.returnedCharacters}/{data.totalCharacters}</dd></div></dl></section>
      <section className={styles.filters} aria-label="Activity history filters">{(["all", "pve", "pvp", "gambit", "other"] as HistoryFilter[]).map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All activity" : value.toUpperCase()}</button>)}</section>
      {!rows.length ? <section className={styles.empty}><ShieldQuestion /><h2>No matching activity found</h2><p>{data.state === "unavailable" ? "Bungie did not return activity history for any current character. The data may be private or temporarily unavailable." : "Try another filter or check again after you complete an activity. Some older or private activities may not appear."}</p></section> : <section className={styles.timeline}>{rows.map((entry) => <ActivityRow key={entry.instanceId} entry={entry} />)}</section>}
    </>}
    <section className={styles.guide}>
      <header><BookOpen /><div><span>New Guardian guide · v{guide.schemaVersion}</span><h2>{guide.title}</h2><p>{guide.summary}</p></div><small>Reviewed {new Date(`${guide.reviewedAt}T00:00:00Z`).toLocaleDateString()}</small></header>
      <div className={styles.steps}>{guide.steps.map((step, index) => <article key={step.id}><b>{index + 1}</b><h3>{step.title}</h3><p>{step.summary}</p><Link to={step.to}>{step.action}</Link></article>)}</div>
      <div className={styles.terms}>{guide.terms.map((entry) => <dl key={entry.term}><dt>{entry.term}</dt><dd>{entry.meaning}</dd></dl>)}</div>
    </section>
  </AuthGate>;
}

function ActivityRow({ entry }: { entry: ActivityHistoryEntry }) {
  const combat = [entry.kills !== undefined ? `${Math.round(entry.kills)} kills` : "", entry.deaths !== undefined ? `${Math.round(entry.deaths)} deaths` : "", entry.assists !== undefined ? `${Math.round(entry.assists)} assists` : ""].filter(Boolean).join(" · ");
  return <article>
    <time dateTime={entry.period}>{new Date(entry.period).toLocaleString()}</time><div><span>{entry.kind.toUpperCase()} · {entry.modeName} · {entry.characterClass}</span><h3>{entry.activityName}</h3>{entry.activityDescription && <p>{entry.activityDescription}</p>}<aside>{entry.completed !== undefined && <span><Check /> {entry.completed ? "Completed" : "Not completed"}</span>}{entry.durationSeconds !== undefined && <span><Clock3 /> {duration(entry.durationSeconds)}</span>}{entry.score !== undefined && <span><Target /> {Math.round(entry.score)} score</span>}{combat && <span><Swords /> {combat}</span>}</aside></div>
  </article>;
}

function historyState(data: ActivityHistoryData) {
  if (data.state === "partial") return "Some current characters could not be read; the visible rows are real but incomplete.";
  if (data.state === "unavailable") return "No character history could be verified from Bungie.";
  if (data.state === "empty") return "Bungie returned the characters successfully but no recent activity rows.";
  return "History was returned for every current character and is capped to the 50 newest unique activities.";
}
function duration(seconds: number) { const minutes = Math.max(0, Math.round(seconds / 60)); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
