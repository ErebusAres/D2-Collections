import type { QuestData, QuestObjective, QuestProgress, QuestStepProgress } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bookmark, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, CircleHelp, Clock3, Compass, Crosshair, Gift, LayoutGrid, ListFilter, Rows3, Search, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/Page";
import { pinsKey, useGuardian } from "../state/GuardianContext";
import styles from "./Pages.module.css";
import questStyles from "./QuestsPage.module.css";

type QuestFilter = "all" | "pinned" | "tracked" | "near" | "activity";
type QuestLayout = "grid" | "list";
type QuestTooltipState = { questId: string; anchor: HTMLElement; locked: boolean };
type QuestTooltipPosition = { top: number; left: number; maxHeight: number };

const TOOLTIP_CLOSE_DELAY = 180;
const TOOLTIP_GAP = 10;
const TOOLTIP_MARGIN = 12;
const TOOLTIP_WIDTH = 390;

export function getQuestTooltipPosition(
  anchor: Pick<DOMRect, "top" | "left" | "right">,
  board: Pick<DOMRect, "left" | "right">,
  viewportWidth: number,
  viewportHeight: number
): QuestTooltipPosition {
  const width = Math.max(280, Math.min(TOOLTIP_WIDTH, viewportWidth - TOOLTIP_MARGIN * 2));
  const minLeft = Math.max(TOOLTIP_MARGIN, board.left);
  const maxRight = Math.min(viewportWidth - TOOLTIP_MARGIN, board.right);
  const maxLeft = Math.max(minLeft, maxRight - width);
  const rightCandidate = anchor.right + TOOLTIP_GAP;
  const leftCandidate = anchor.left - TOOLTIP_GAP - width;
  const left = rightCandidate + width <= maxRight
    ? rightCandidate
    : leftCandidate >= minLeft
      ? leftCandidate
      : maxLeft;
  const minimumVisibleHeight = Math.min(420, viewportHeight - TOOLTIP_MARGIN * 2);
  const top = Math.max(TOOLTIP_MARGIN, Math.min(anchor.top, viewportHeight - TOOLTIP_MARGIN - minimumVisibleHeight));
  return { top, left, maxHeight: Math.max(220, viewportHeight - top - TOOLTIP_MARGIN) };
}

export function QuestsPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const membershipId = session?.guardian?.membershipId || "";
  const storageKey = pinsKey(membershipId, selectedCharacterId);
  const [pins, setPins] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<QuestFilter>("all");
  const [search, setSearch] = useState("");
  const [tooltip, setTooltip] = useState<QuestTooltipState | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<QuestTooltipPosition | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [layout, setLayout] = useState<QuestLayout>(() => localStorage.getItem("guardian-nexus:quest-layout") === "list" ? "list" : "grid");
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
  }).sort((a, b) => Number(pins.has(b.instanceId)) - Number(pins.has(a.instanceId)) || Number(b.inGameTracked) - Number(a.inGameTracked) || a.name.localeCompare(b.name)), [result.data, filter, search, pins]);
  const primaryQuests = quests.filter((quest) => !quest.category || quest.category === "quest");
  const compactPursuits = quests.filter((quest) => quest.category === "bounty" || quest.category === "order");
  const tooltipQuest = result.data?.data.quests.find((quest) => quest.instanceId === tooltip?.questId && (!quest.category || quest.category === "quest"));
  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const closeTooltip = useCallback(() => {
    clearCloseTimer();
    setTooltip(null);
    setTooltipPosition(null);
  }, [clearCloseTimer]);
  const previewTooltip = useCallback((questId: string, anchor: HTMLElement) => {
    clearCloseTimer();
    setTooltip((current) => current?.locked ? current : { questId, anchor, locked: false });
  }, [clearCloseTimer]);
  const toggleTooltip = useCallback((questId: string, anchor: HTMLElement) => {
    clearCloseTimer();
    if (tooltip?.locked && tooltip.questId === questId) {
      closeTooltip();
      return;
    }
    setTooltip({ questId, anchor, locked: true });
  }, [clearCloseTimer, closeTooltip, tooltip]);
  const scheduleTooltipClose = useCallback(() => {
    if (tooltip?.locked) return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      setTooltip(null);
      setTooltipPosition(null);
      closeTimer.current = null;
    }, TOOLTIP_CLOSE_DELAY);
  }, [clearCloseTimer, tooltip?.locked]);
  useEffect(() => {
    if (tooltip && !primaryQuests.some((quest) => quest.instanceId === tooltip.questId)) closeTooltip();
  }, [closeTooltip, primaryQuests, tooltip]);
  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);
  useEffect(() => {
    if (!tooltip?.locked) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || tooltip.anchor.contains(target) || target.closest("[data-quest-inspect]")) return;
      closeTooltip();
    };
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeTooltip(); };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [closeTooltip, tooltip]);
  useLayoutEffect(() => {
    if (!tooltip) return;
    let frame = 0;
    const placeTooltip = () => {
      if (!tooltip.anchor.isConnected) {
        closeTooltip();
        return;
      }
      const anchorRect = tooltip.anchor.getBoundingClientRect();
      const boardRect = tooltip.anchor.closest<HTMLElement>("[data-quest-board]")?.getBoundingClientRect() || anchorRect;
      setTooltipPosition(getQuestTooltipPosition(anchorRect, boardRect, window.innerWidth, window.innerHeight));
    };
    const queuePlacement = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(placeTooltip);
    };
    placeTooltip();
    window.addEventListener("resize", queuePlacement);
    window.addEventListener("scroll", queuePlacement, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", queuePlacement);
      window.removeEventListener("scroll", queuePlacement, true);
    };
  }, [closeTooltip, tooltip]);
  const togglePin = (quest: QuestProgress) => setPins((current) => {
    const next = new Set(current);
    if (next.has(quest.instanceId)) next.delete(quest.instanceId); else next.add(quest.instanceId);
    localStorage.setItem(storageKey, JSON.stringify([...next]));
    return next;
  });
  const chooseLayout = (value: QuestLayout) => { setLayout(value); localStorage.setItem("guardian-nexus:quest-layout", value); };

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
        <div className={styles.layoutToggle}><button className={layout === "grid" ? styles.activeFilter : ""} onClick={() => chooseLayout("grid")}><LayoutGrid size={14} />Grid</button><button className={layout === "list" ? styles.activeFilter : ""} onClick={() => chooseLayout("list")}><Rows3 size={14} />List</button></div>
      </section>
      <section className={questStyles.questWorkspace}>
        <div className={questStyles.questBoard} data-quest-board>
          {primaryQuests.length ? <section className={`${layout === "grid" ? styles.questGrid : styles.questList} ${questStyles.questCards}`}>{primaryQuests.map((quest) => {
            const interaction = {
              selected: tooltip?.questId === quest.instanceId,
              onPreview: (anchor: HTMLElement) => previewTooltip(quest.instanceId, anchor),
              onLeave: scheduleTooltipClose,
              onToggle: (anchor: HTMLElement) => toggleTooltip(quest.instanceId, anchor)
            };
            return layout === "grid"
              ? <QuestGridCard key={quest.instanceId} quest={quest} pinned={pins.has(quest.instanceId)} onPin={() => togglePin(quest)} {...interaction} />
              : <QuestCard key={quest.instanceId} quest={quest} pinned={pins.has(quest.instanceId)} onPin={() => togglePin(quest)} {...interaction} />;
          })}</section> : compactPursuits.length === 0 && <div className={styles.inlineEmpty}><ListFilter /><h2>No quests match this view</h2><p>Adjust the filter or wait for Bungie to mint a newer character inventory response.</p></div>}
        </div>
        {compactPursuits.length > 0 && <aside className={`${styles.compactPursuits} ${questStyles.bountyRail}`}><header><div><Crosshair /><span>Bounties, hub orders & vendor orders</span></div><strong>{compactPursuits.length}</strong></header><div>{compactPursuits.map((quest) => <CompactPursuit key={quest.instanceId} quest={quest} pinned={pins.has(quest.instanceId)} onPin={() => togglePin(quest)} />)}</div></aside>}
      </section>
      {tooltipQuest && tooltipPosition && createPortal(<QuestInspectPanel quest={tooltipQuest} position={tooltipPosition} onClose={closeTooltip} onPointerEnter={clearCloseTimer} onPointerLeave={scheduleTooltipClose} />, document.body)}
    </>}
  </AuthGate>;
}

type QuestCardInteraction = {
  selected: boolean;
  onPreview: (anchor: HTMLElement) => void;
  onLeave: () => void;
  onToggle: (anchor: HTMLElement) => void;
};

function shouldToggleTooltip(target: EventTarget | null): boolean {
  return target instanceof Element && !target.closest("a, button, input, select, textarea");
}

function QuestCard({ quest, pinned, selected, onPin, onPreview, onLeave, onToggle }: { quest: QuestProgress; pinned: boolean; onPin: () => void } & QuestCardInteraction) {
  const [expanded, setExpanded] = useState(false);
  const steps = quest.steps?.length ? quest.steps : [fallbackStep(quest)];
  return <article className={`${styles.questCard} ${quest.inGameTracked ? styles.questTracked : ""} ${selected ? questStyles.questSelected : ""}`} tabIndex={0} aria-expanded={selected} onMouseEnter={(event) => onPreview(event.currentTarget)} onMouseLeave={onLeave} onFocusCapture={(event) => onPreview(event.currentTarget)} onBlurCapture={onLeave} onClick={(event) => { if (shouldToggleTooltip(event.target)) onToggle(event.currentTarget); }}>
    <div className={styles.questIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <Crosshair />}</div>
    <div className={styles.questMain}><div className={styles.questMeta}><span>{quest.activityName || "Active quest"}</span>{quest.stepNumber && quest.stepCount && <b>Step {quest.stepNumber}/{quest.stepCount}</b>}{quest.inGameTracked && <em><Crosshair size={11} /> Tracked in Destiny</em>}</div><h2>{quest.name}</h2><p>{quest.currentStep}</p>
      <div className={styles.objectives}>{quest.objectives.length ? quest.objectives.map((objective) => <div key={objective.objectiveHash}><span><b>{objective.name}</b><small>{objective.progress.toLocaleString()} / {objective.completionValue.toLocaleString()}</small></span><i><span style={{ width: `${objective.percent}%` }} /></i>{objective.complete ? <CheckCircle2 size={16} /> : <strong>{objective.percent}%</strong>}</div>) : <div><span><b>Progress details unavailable</b><small>Bungie returned no item objectives.</small></span></div>}</div>
    </div>
    <div className={styles.questAside}><span>Step progress</span><strong>{quest.percent}%</strong><div className={styles.radial} style={{ "--progress": `${quest.percent * 3.6}deg` } as React.CSSProperties}><span /></div><button className={pinned ? styles.pinned : ""} onClick={onPin}><Bookmark size={15} fill={pinned ? "currentColor" : "none"} />{pinned ? "Pinned" : "Pin in site"}</button><Link className={styles.questDetailsLink} to={`/quests/${encodeURIComponent(quest.instanceId)}`}><ChevronRight size={14} />View details</Link><button className={styles.questExpand} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{expanded ? "Hide steps" : `All ${steps.length} steps`}</button><small><Clock3 size={11} /> {new Date(quest.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div>
    {expanded && <QuestTimeline steps={steps} />}
  </article>;
}

function QuestGridCard({ quest, pinned, selected, onPin, onPreview, onLeave, onToggle }: { quest: QuestProgress; pinned: boolean; onPin: () => void } & QuestCardInteraction) {
  const objective = quest.objectives.find((entry) => !entry.complete) || quest.objectives[0];
  return <article className={`${styles.questGridCard} ${quest.inGameTracked ? styles.questTracked : ""} ${pinned ? styles.questPinned : ""} ${selected ? questStyles.questSelected : ""}`} tabIndex={0} aria-expanded={selected} onMouseEnter={(event) => onPreview(event.currentTarget)} onMouseLeave={onLeave} onFocusCapture={(event) => onPreview(event.currentTarget)} onBlurCapture={onLeave} onClick={(event) => { if (shouldToggleTooltip(event.target)) onToggle(event.currentTarget); }}>
    <header><div className={styles.questGridIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <Crosshair />}</div><div><span>{quest.activityName || "Active quest"}</span><h2>{quest.name}</h2></div><button className={pinned ? styles.pinned : ""} onClick={onPin} aria-label={pinned ? `Unpin ${quest.name}` : `Pin ${quest.name}`}><Bookmark size={15} fill={pinned ? "currentColor" : "none"} /></button></header>
    <p>{quest.currentStep}</p><div className={styles.questGridProgress}><span><b>{objective?.name || "Step progress"}</b><strong>{quest.percent}%</strong></span><i><span style={{ width: `${quest.percent}%` }} /></i></div>
    <footer>{quest.stepNumber && quest.stepCount ? <span>Step {quest.stepNumber}/{quest.stepCount}</span> : <span>Current step</span>}<Link to={`/quests/${encodeURIComponent(quest.instanceId)}`}>Details <ChevronRight size={13} /></Link></footer>
  </article>;
}

export function QuestInspectPanel({ quest, position, onClose, onPointerEnter, onPointerLeave }: { quest: QuestProgress; position?: QuestTooltipPosition; onClose: () => void; onPointerEnter?: () => void; onPointerLeave?: () => void }) {
  return <>
    <button className={questStyles.questInspectScrim} onClick={onClose} aria-label="Close quest details" />
    <aside className={questStyles.questInspectPanel} style={position} aria-label={`${quest.name} details`} data-quest-inspect onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocusCapture={onPointerEnter} onBlurCapture={onPointerLeave}>
      <header className={questStyles.questInspectHeader}>
        <div className={questStyles.questInspectIcon}>{quest.icon ? <img src={quest.icon} alt="" /> : <Crosshair />}</div>
        <div><span>{quest.itemType || "Quest Step"}{quest.rarity ? ` · ${quest.rarity}` : ""}</span><h2>{quest.name}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close quest details"><X /></button>
      </header>
      <div className={questStyles.questInspectBody}>
        <p className={questStyles.questInspectDescription}>{quest.description || quest.currentStep || "Bungie did not provide a description for this quest step."}</p>
        {quest.flavorText && <blockquote>{quest.flavorText}</blockquote>}
        <section className={questStyles.inspectObjectives}>
          <header><span>Objectives</span><strong>{quest.objectives.filter((objective) => objective.complete).length}/{quest.objectives.length}</strong></header>
          {quest.objectives.length ? quest.objectives.map((objective) => <InspectObjective key={objective.objectiveHash} objective={objective} />) : <div className={questStyles.inspectUnavailable}><CircleHelp /><span>Bungie returned no live objectives for this item.</span></div>}
        </section>
        <section className={questStyles.inspectRewards}>
          <header><Gift /><span>Rewards</span></header>
          {quest.rewards.length ? <div>{quest.rewards.map((reward, index) => <article key={`${reward.itemHash}-${index}`}>
            <div className={questStyles.inspectRewardArt}>{reward.definitionAvailable && reward.icon ? <img src={reward.icon} alt="" loading="lazy" /> : <span>Image unavailable</span>}</div>
            <main><strong>{reward.name}</strong>{reward.quantity > 1 && <b>×{reward.quantity.toLocaleString()}</b>}{!reward.definitionAvailable && <small>Manifest definition unavailable</small>}</main>
          </article>)}</div> : <div className={questStyles.inspectUnavailable}><CircleHelp /><span>Bungie does not list a reward for this quest step.</span></div>}
        </section>
        <Link className={questStyles.questInspectLink} to={`/quests/${encodeURIComponent(quest.instanceId)}`}>Open full quest timeline <ChevronRight /></Link>
      </div>
    </aside>
  </>;
}

function InspectObjective({ objective }: { objective: QuestObjective }) {
  const value = objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : objective.complete ? "Complete" : `${objective.percent}%`;
  return <article className={objective.complete ? questStyles.inspectObjectiveComplete : ""}>
    <div><span>{objective.name}</span><strong>{value}</strong>{objective.complete && <CheckCircle2 />}</div>
    <i><span style={{ width: `${objective.percent}%` }} /></i>
  </article>;
}

function CompactPursuit({ quest, pinned, onPin }: { quest: QuestProgress; pinned: boolean; onPin: () => void }) {
  return <article className={styles.compactPursuit} title={`${quest.currentStep}\n${quest.objectives.map((objective) => `${objective.name}: ${objective.percent}%`).join("\n")}`}><div>{quest.icon ? <img src={quest.icon} alt="" /> : <Crosshair />}</div><main><span>{quest.category}</span><strong>{quest.name}</strong><i><span style={{ width: `${quest.percent}%` }} /></i></main><b>{quest.percent}%</b><button className={pinned ? styles.pinned : ""} onClick={onPin} aria-label={pinned ? `Unpin ${quest.name}` : `Pin ${quest.name}`}><Bookmark size={13} fill={pinned ? "currentColor" : "none"} /></button><Link to={`/quests/${encodeURIComponent(quest.instanceId)}`} aria-label={`View ${quest.name}`}><ChevronRight size={14} /></Link></article>;
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
