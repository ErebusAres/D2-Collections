import type { QuestData, QuestObjective, QuestProgress, QuestStepProgress } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bookmark, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Clock3, Compass, Crosshair, ListFilter, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/Page";
import { pinsKey, useGuardian } from "../state/GuardianContext";
import styles from "./Pages.module.css";

type QuestFilter = "all" | "pinned" | "tracked" | "near" | "activity";

export function QuestsPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const membershipId = session?.guardian?.membershipId || "";
  const storageKey = pinsKey(membershipId, selectedCharacterId);
  const [pins, setPins] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<QuestFilter>("all");
  const [search, setSearch] = useState("");
  useEffect(() => { try { setPins(new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"))); } catch { setPins(new Set()); } }, [storageKey]);
  const pinnedParam = [...pins].join(",");
  const result = useQuery({
    queryKey: ["quests", selectedCharacterId, pinnedParam],
    queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=${encodeURIComponent(pinnedParam)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const quests = useMemo(() => (result.data?.data.quests || []).filter((quest) => {
    const textMatch = !search || `${quest.name} ${quest.description} ${quest.activityName}`.toLowerCase().includes(search.toLowerCase());
    const filterMatch = filter === "all" || (filter === "pinned" && pins.has(quest.instanceId)) || (filter === "tracked" && quest.inGameTracked) || (filter === "near" && quest.percent >= 75 && quest.percent < 100) || (filter === "activity" && Boolean(quest.activityName));
    return textMatch && filterMatch;
  }), [result.data, filter, search, pins]);
  const togglePin = (quest: QuestProgress) => setPins((current) => {
    const next = new Set(current);
    if (next.has(quest.instanceId)) next.delete(quest.instanceId); else next.add(quest.instanceId);
    localStorage.setItem(storageKey, JSON.stringify([...next]));
    return next;
  });

  return <AuthGate>
    <PageHeader eyebrow="Pursuit intelligence" title="Quests" description="Track active quest steps, understand objective progress, and surface the most practical next actions without changing anything in game." actions={<Freshness observedAt={result.data?.freshness.observedAt} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(result.data)} onRetry={() => void result.refetch()} />
    {result.data && <>
      <section className={styles.questOverview}>
        <div><span>Active quests</span><strong>{result.data.data.quests.length}</strong></div>
        <div><span>Site pinned</span><strong>{pins.size}</strong></div>
        <div><span>Tracked in Destiny</span><strong>{result.data.data.quests.filter((quest) => quest.inGameTracked).length}</strong></div>
        <div className={styles.activityNow}><Compass /><span>Current activity</span><strong>{result.data.data.currentActivity || "Orbit / unavailable"}</strong></div>
      </section>
      {result.data.data.recommendations.length > 0 && <section className={styles.recommendations}><header><div><Sparkles /><span>Recommended next</span></div><p>Ranked from your pins, in-game tracking, activity overlap, urgency, and progress.</p></header><div>{result.data.data.recommendations.slice(0, 3).map((recommendation, index) => <article key={recommendation.quest.instanceId}><b>0{index + 1}</b><div><span>{recommendation.quest.activityName || "Active pursuit"}{recommendation.quest.stepNumber && recommendation.quest.stepCount ? ` · Step ${recommendation.quest.stepNumber}/${recommendation.quest.stepCount}` : ""}</span><h2>{recommendation.quest.name}</h2><p>{recommendation.quest.currentStep}</p><div className={styles.reasonRow}>{recommendation.reasons.map((reason) => <em key={reason}>{reason}</em>)}</div></div><strong>{recommendation.quest.percent}%</strong></article>)}</div></section>}
      <section className={styles.commandBar}>
        <label className={styles.search}><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search active quests…" /></label>
        <div className={styles.questFilters}>{([
          ["all", "All", ListFilter], ["pinned", "Site pinned", Bookmark], ["tracked", "In-game tracked", Crosshair], ["near", "Near complete", CheckCircle2], ["activity", "Activity", Activity]
        ] as const).map(([value, label, Icon]) => <button key={value} className={filter === value ? styles.activeFilter : ""} onClick={() => setFilter(value)}><Icon size={14} />{label}</button>)}</div>
      </section>
      {quests.length ? <section className={styles.questList}>{quests.map((quest) => <QuestCard key={quest.instanceId} quest={quest} pinned={pins.has(quest.instanceId)} onPin={() => togglePin(quest)} />)}</section> : <div className={styles.inlineEmpty}><ListFilter /><h2>No quests match this view</h2><p>Adjust the filter or wait for Bungie to mint a newer character inventory response.</p></div>}
    </>}
  </AuthGate>;
}

function QuestCard({ quest, pinned, onPin }: { quest: QuestProgress; pinned: boolean; onPin: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const steps = quest.steps?.length ? quest.steps : [fallbackStep(quest)];
  return <article className={`${styles.questCard} ${quest.inGameTracked ? styles.questTracked : ""}`}>
    <div className={styles.questIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <Crosshair />}</div>
    <div className={styles.questMain}><div className={styles.questMeta}><span>{quest.activityName || "Active quest"}</span>{quest.stepNumber && quest.stepCount && <b>Step {quest.stepNumber}/{quest.stepCount}</b>}{quest.inGameTracked && <em><Crosshair size={11} /> Tracked in Destiny</em>}</div><h2>{quest.name}</h2><p>{quest.currentStep}</p>
      <div className={styles.objectives}>{quest.objectives.length ? quest.objectives.map((objective) => <div key={objective.objectiveHash}><span><b>{objective.name}</b><small>{objective.progress.toLocaleString()} / {objective.completionValue.toLocaleString()}</small></span><i><span style={{ width: `${objective.percent}%` }} /></i>{objective.complete ? <CheckCircle2 size={16} /> : <strong>{objective.percent}%</strong>}</div>) : <div><span><b>Progress details unavailable</b><small>Bungie returned no item objectives.</small></span></div>}</div>
    </div>
    <div className={styles.questAside}><span>Step progress</span><strong>{quest.percent}%</strong><div className={styles.radial} style={{ "--progress": `${quest.percent * 3.6}deg` } as React.CSSProperties}><span /></div><button className={pinned ? styles.pinned : ""} onClick={onPin}><Bookmark size={15} fill={pinned ? "currentColor" : "none"} />{pinned ? "Pinned" : "Pin in site"}</button><button className={styles.questExpand} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{expanded ? "Hide steps" : `All ${steps.length} steps`}</button><small><Clock3 size={11} /> {new Date(quest.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
    {expanded && <QuestTimeline steps={steps} />}
  </article>;
}

function QuestTimeline({ steps }: { steps: QuestStepProgress[] }) {
  return <section className={styles.questTimeline}><header><div><span>Quest route</span><strong>{steps.filter((step) => step.status === "completed").length}/{steps.length} steps completed</strong></div><b>{overallProgress(steps)}% overall</b></header><div>{steps.map((step) => <article key={`${step.stepNumber}-${step.itemHash}`} className={`${styles.questStep} ${styles[`questStep${capitalize(step.status)}`]}`}><aside>{step.status === "completed" ? <CheckCircle2 /> : step.status === "current" ? <Crosshair /> : <CircleDashed />}<i /></aside><main><header><div><span>Step {step.stepNumber}/{steps.length}</span><em>{step.status}</em></div><strong>{step.progressKnown ? `${step.percent}%` : "Progress unavailable"}</strong></header><h3>{step.name}</h3>{step.description && step.description !== step.name && <p>{step.description}</p>}<div className={styles.stepObjectives}>{step.objectives.length ? step.objectives.map((objective) => <StepObjective key={objective.objectiveHash} objective={objective} status={step.status} progressKnown={step.progressKnown} />) : <small>{step.status === "completed" ? "Completed before the current step." : step.status === "future" ? "No additional objective counter is exposed for this step." : "Bungie returned no live objective counter."}</small>}</div></main></article>)}</div></section>;
}

function StepObjective({ objective, status, progressKnown }: { objective: QuestObjective; status: QuestStepProgress["status"]; progressKnown: boolean }) {
  const report = !progressKnown ? "Live progress unavailable" : objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : status === "completed" ? "Complete" : `${objective.percent}%`;
  return <div><span><b>{objective.name}</b><small>{report}</small></span><i><span style={{ width: `${progressKnown ? objective.percent : 0}%` }} /></i>{objective.complete ? <CheckCircle2 /> : <strong>{progressKnown ? `${objective.percent}%` : "—"}</strong>}</div>;
}

function fallbackStep(quest: QuestProgress): QuestStepProgress { return { itemHash: quest.itemHash, stepNumber: quest.stepNumber || 1, name: quest.currentStep, description: quest.description, status: "current", objectives: quest.objectives, percent: quest.percent, progressKnown: quest.objectives.length > 0 }; }
function overallProgress(steps: QuestStepProgress[]): number { return steps.length ? Math.round(steps.reduce((sum, step) => sum + (step.status === "completed" ? 100 : step.status === "current" ? step.percent : 0), 0) / steps.length) : 0; }
function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
