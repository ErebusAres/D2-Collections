import type { GuardianRankData, GuardianRankQuest, GuardianRankTier } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Check, CheckCircle2, ChevronDown, ChevronUp, CircleDashed, Compass, Crosshair, History, LockKeyhole, Maximize2, Minimize2, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { CompletionPing, useCompletionPings } from "../components/common/CompletionPing";
import { JourneyNav } from "../components/journey/JourneyNav";
import { useGuardian } from "../context/GuardianContext";
import { completionTransition, guardianRankCompletionCandidates } from "../modules/tracking/completionTracking";
import { api } from "../services/api/client";
import { LIVE_REFRESH_INTERVAL_MS } from "../services/liveRefresh";
import styles from "./GuardianRankPage.module.css";

type QuestFilter = "all" | "tracked" | "incomplete" | "complete";

export function GuardianRankPage() {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const [selectedRankNumber, setSelectedRankNumber] = useState<number>();
  const [filter, setFilter] = useState<QuestFilter>("all");
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const completionState = useRef<{ characterId: string; values: Map<string, boolean> | null }>({ characterId: "", values: null });
  const { notice: completionNotice, announce: announceCompletion, dismiss: dismissCompletion, clear: clearCompletions } = useCompletionPings();
  const result = useQuery({
    queryKey: ["guardian-rank", selectedCharacterId],
    queryFn: () => api<GuardianRankData>(`/api/v1/me/guardian-rank?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: LIVE_REFRESH_INTERVAL_MS,
    refetchInterval: autoRefresh ? LIVE_REFRESH_INTERVAL_MS : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  useEffect(() => {
    setSelectedRankNumber(undefined);
    setFilter("all");
    setSearch("");
    setCollapsedCategories(new Set());
  }, [selectedCharacterId]);
  useEffect(() => {
    if (data && selectedRankNumber === undefined) setSelectedRankNumber(data.suggestedRank);
  }, [data, selectedRankNumber]);
  const tracked = useMemo(() => parseTracked(preferences["guardianRank.tracked"]), [preferences]);
  useEffect(() => {
    if (!data) return;
    const previous = completionState.current.characterId === selectedCharacterId ? completionState.current.values : null;
    if (!previous) clearCompletions();
    const candidates = guardianRankCompletionCandidates(data, tracked);
    const transition = completionTransition(previous, candidates);
    completionState.current = { characterId: selectedCharacterId, values: transition.state };
    announceCompletion(transition.newlyCompleted);

    const completedTracked = new Set(candidates.filter((candidate) => candidate.complete && candidate.trackedInGuardianNexus).map((candidate) => candidate.id));
    if (completedTracked.size) {
      setPreference("guardianRank.tracked", JSON.stringify([...tracked].filter((recordHash) => !completedTracked.has(recordHash))));
    }
  }, [announceCompletion, clearCompletions, data, selectedCharacterId, setPreference, tracked]);
  const selectedRank = data?.ranks.find((rank) => rank.rankNumber === selectedRankNumber) || data?.ranks.find((rank) => rank.rankNumber === data.suggestedRank);
  useEffect(() => {
    setCollapsedCategories(new Set(selectedRank?.categories.filter(isCategoryComplete).map((category) => category.nodeHash) || []));
  }, [selectedRank?.rankHash]);
  const visibleCategories = useMemo(() => selectedRank?.categories.map((category) => ({
    ...category,
    quests: category.quests.filter((quest) => {
      const textMatch = !search || `${quest.name} ${quest.description} ${quest.objectives.map((objective) => objective.name).join(" ")}`.toLowerCase().includes(search.toLowerCase());
      const filterMatch = filter === "all"
        || filter === "tracked" && tracked.has(quest.recordHash)
        || filter === "incomplete" && quest.state !== "completed"
        || filter === "complete" && quest.state === "completed";
      return textMatch && filterMatch;
    })
  })).filter((category) => category.quests.length) || [], [filter, search, selectedRank, tracked]);
  const categoryGroups = useMemo(() => [{
    key: "active", label: "Active sections", description: "Objectives that still need progress", categories: visibleCategories.filter((category) => !isCategoryComplete(category))
  }, {
    key: "completed", label: "Completed sections", description: "Finished objectives, collapsed by default", categories: visibleCategories.filter(isCategoryComplete)
  }].filter((group) => group.categories.length > 0), [visibleCategories]);
  const currentRankTier = data?.ranks.find((rank) => rank.rankNumber === data.currentRank);
  const nextRank = data?.ranks.find((rank) => rank.rankNumber === data.currentRank + 1);

  const toggleTracked = (recordHash: string) => {
    const next = new Set(tracked);
    if (next.has(recordHash)) next.delete(recordHash); else next.add(recordHash);
    setPreference("guardianRank.tracked", JSON.stringify([...next]));
  };
  const toggleCategory = (nodeHash: string) => setCollapsedCategories((current) => {
    const next = new Set(current);
    if (next.has(nodeHash)) next.delete(nodeHash); else next.add(nodeHash);
    return next;
  });

  return <AuthGate>
    <CompletionPing notice={completionNotice} onDismiss={dismissCompletion} />
    <PageHeader
      eyebrow="Guardian journey"
      title="Guardian Rank"
      description="Current and renewed progress stays separate from highest-achieved rank."
      actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />}
    />
    <JourneyNav />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.overview}>
        <div className={styles.currentMedallion}><ShieldCheck /><span>Current / renewed rank</span><strong>{data.currentRank}</strong></div>
        <div><span>Current journey</span><strong>{currentRankTier?.name || "Unavailable"}</strong><small>Rank selector starts here</small></div>
        <div><span>Next rank</span><strong>{nextRank ? `${nextRank.rankNumber} · ${nextRank.name}` : `${data.maximumRank} · Maximum`}</strong><small>{data.currentRank >= data.maximumRank ? "Maximum Guardian Rank achieved" : currentRankTier?.total ? `${currentRankTier.completed}/${currentRankTier.total} requirements complete` : `Complete rank ${data.currentRank} requirements to unlock rank ${Math.min(data.currentRank + 1, data.maximumRank)}`}</small></div>
        <div><span>Highest rank achieved</span><strong>{data.highestAchievedRank}</strong><small>Bungie's displayed rank for this season</small></div>
        <div><span>Lifetime highest</span><strong>{data.lifetimeHighestRank}</strong><small>Historical best · never decreases</small></div>
        <div><span>Site tracked</span><strong>{tracked.size}</strong><small>Saved to your Guardian Nexus profile</small></div>
      </section>

      <section className={styles.rankRail} aria-label="Guardian Rank history">
        {data.ranks.map((rank) => <button
          key={rank.rankHash}
          className={`${styles.rankNode} ${styles[rank.state]} ${rank.rankNumber === selectedRank?.rankNumber ? styles.selected : ""}`}
          onClick={() => setSelectedRankNumber(rank.rankNumber)}
          aria-label={`View rank ${rank.rankNumber}: ${rank.name}`}
          aria-pressed={rank.rankNumber === selectedRank?.rankNumber}
        >
          <RankEmblem rank={rank} />
          <small>{rank.name}</small>
          <em>{rank.state === "previous" ? <><Check /> Previous</> : rank.state === "current" ? "Current" : rank.state === "next" ? "Upcoming" : <><LockKeyhole /> Future</>}</em>
        </button>)}
      </section>

      {selectedRank && <section className={styles.rankWorkspace}>
        <header className={styles.rankHero}>
          <div className={styles.rankArtwork} data-testid="selected-rank-artwork">
            <RankEmblem rank={selectedRank} />
          </div>
          <div>
            <span>{rankEyebrow(selectedRank, data.currentRank, data.maximumRank)}</span>
            <h2>{selectedRank.name}</h2>
            <p>{selectedRank.description}</p>
          </div>
          <RankCompletion rank={selectedRank} currentRank={data.currentRank} maximumRank={data.maximumRank} />
        </header>

        <div className={styles.commandBar}>
          <label><Search /><input type="search" data-page-search aria-label="Search Guardian Rank objectives" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rank objectives…" /></label>
          <div>{([[
            "all", "All", Compass
          ], ["tracked", "Tracked", Bookmark], ["incomplete", "Incomplete", CircleDashed], ["complete", "Complete", CheckCircle2]] as const).map(([value, label, Icon]) => <button key={value} className={filter === value ? styles.activeFilter : ""} onClick={() => setFilter(value)}><Icon />{label}</button>)}</div>
          <div className={styles.foldControls} aria-label="Objective section display">
            <button onClick={() => setCollapsedCategories(new Set(visibleCategories.map((category) => category.nodeHash)))}><Minimize2 />Collapse all</button>
            <button onClick={() => setCollapsedCategories(new Set())}><Maximize2 />Expand all</button>
          </div>
        </div>

        {visibleCategories.length ? <div className={styles.categoryGroups}>{categoryGroups.map((group) => {
          const columns = balanceCategoryColumns(group.categories, collapsedCategories);
          return <section className={styles.categoryGroup} key={group.key}>
          <header><span><small>{group.description}</small><h2>{group.label}</h2></span><strong>{group.categories.length}</strong></header>
          <div className={styles.categoryGrid}>{columns.map((columnCategories, column) => <div className={styles.categoryColumn} data-testid={`category-column-${group.key}-${column}`} key={column}>{columnCategories.map((category) => {
          const complete = isCategoryComplete(category);
          const collapsed = collapsedCategories.has(category.nodeHash);
          return <section className={`${styles.category} ${complete ? styles.categoryComplete : ""} ${collapsed ? styles.categoryCollapsed : ""}`} key={category.nodeHash}>
            <header><div>{category.icon ? <img src={category.icon} alt="" /> : complete ? <CheckCircle2 /> : <Sparkles />}</div><span><small>{complete ? "Completed" : category.seasonal ? "Seasonal objectives" : "Rank objectives"}</small><h3>{category.name}</h3></span><strong>{category.completed}/{category.total}</strong><button type="button" onClick={() => toggleCategory(category.nodeHash)} aria-expanded={!collapsed} aria-controls={`rank-category-${category.nodeHash}`} aria-label={`${collapsed ? "Expand" : "Collapse"} ${category.name}`} title={collapsed ? "Expand section" : "Collapse section"}>{collapsed ? <ChevronDown /> : <ChevronUp />}</button></header>
            <div id={`rank-category-${category.nodeHash}`} hidden={collapsed} className={styles.categoryBody}>
              {category.description && <p>{category.description}</p>}
              <div>{category.quests.map((quest) => <QuestCard key={quest.recordHash} quest={quest} tracked={tracked.has(quest.recordHash)} onTrack={() => toggleTracked(quest.recordHash)} />)}</div>
            </div>
          </section>;
        })}</div>)}</div></section>;
        })}</div> : <section className={styles.empty}><History /><h2>{selectedRank.rankNumber === data.maximumRank ? "Maximum Guardian Rank" : "No objectives match this view"}</h2><p>{selectedRank.rankNumber === data.maximumRank ? `Rank ${data.maximumRank} is the highest achievable rank. There are no additional objectives after reaching it.` : selectedRank.total ? "Change the filter or search to see this rank's objectives." : "Bungie's current Guardian Rank definition contains no individual objectives for this rank."}</p></section>}
      </section>}
      <footer className={styles.sourceNote}>Current progress uses Bungie's renewed rank. Highest-achieved and lifetime-highest ranks remain separate. Missing objective data stays unavailable.</footer>
    </>}
  </AuthGate>;
}

function RankEmblem({ rank }: { rank: GuardianRankTier }) {
  return <span className={styles.rankEmblem} aria-hidden="true">
    {rank.icon ? <img src={rank.icon} alt="" /> : <i>{rank.rankNumber}</i>}
  </span>;
}

function QuestCard({ quest, tracked, onTrack }: { quest: GuardianRankQuest; tracked: boolean; onTrack: () => void }) {
  const status = quest.state === "completed" ? "Complete" : quest.state === "in-progress" ? "In progress" : quest.state === "not-started" ? "Not started" : "Progress unavailable";
  return <article className={`${styles.quest} ${styles[`quest-${quest.state}`]}`}>
    <header><span>{quest.icon ? <img src={quest.icon} alt="" /> : quest.state === "completed" ? <CheckCircle2 /> : <Crosshair />}</span><div><small>{status}{quest.trackedInDestiny ? " · Tracked in Destiny" : ""}</small><h4>{quest.name}</h4></div><button onClick={onTrack} className={tracked ? styles.tracked : ""} aria-label={tracked ? `Stop tracking ${quest.name}` : `Track ${quest.name}`} title={tracked ? "Stop tracking in Guardian Nexus" : "Track in Guardian Nexus"}><Bookmark fill={tracked ? "currentColor" : "none"} /></button></header>
    {quest.description && <p>{quest.description}</p>}
    <div className={styles.objectives}>{quest.objectives.length ? quest.objectives.map((objective) => <div key={objective.objectiveHash} className={objective.completionValue === 1 ? styles.binaryObjective : ""}>
      <span><b>{objective.name}</b><small>{objective.progressAvailable ? objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : objective.complete ? "Complete" : "In progress" : "Bungie did not return a live counter"}{objective.complete && <CheckCircle2 />}</small></span>
      {objective.completionValue !== 1 && <i><span style={{ width: `${objective.percent}%` }} /></i>}
    </div>) : <div className={styles.recordOnly}><span><b>{status}</b><small>No numeric objective.</small></span></div>}</div>
  </article>;
}

function RankCompletion({ rank, currentRank, maximumRank }: { rank: GuardianRankTier; currentRank: number; maximumRank: number }) {
  if (rank.rankNumber === maximumRank) {
    const achieved = currentRank >= maximumRank;
    return <div className={styles.rankCompletion}><span>Rank ceiling</span><strong>{achieved ? "Maximum achieved" : `Rank ${maximumRank}`}</strong><i><span style={{ width: achieved ? "100%" : "0%" }} /></i><small>{achieved ? "Complete" : "No further objectives"}</small></div>;
  }
  const percent = rank.total ? Math.round((rank.completed / rank.total) * 100) : rank.state === "previous" || rank.state === "current" ? 100 : 0;
  return <div className={styles.rankCompletion}><span>Progress to rank {Math.min(rank.rankNumber + 1, maximumRank)}</span><strong>{rank.completed} / {rank.total}</strong><i><span style={{ width: `${percent}%` }} /></i><small>{percent}%</small></div>;
}

function rankEyebrow(rank: GuardianRankTier, currentRank: number, maximumRank: number): string {
  if (rank.rankNumber === maximumRank) return currentRank >= maximumRank ? "Maximum Guardian Rank achieved" : "Highest achievable Guardian Rank";
  const unlocks = Math.min(rank.rankNumber + 1, maximumRank);
  if (rank.rankNumber < currentRank) return `Previous rank · unlocked rank ${unlocks}`;
  if (rank.rankNumber === currentRank) return `Current rank · objectives unlock rank ${unlocks}`;
  return `Future rank · objectives unlock rank ${unlocks}`;
}

function parseTracked(value?: string): Set<string> {
  try {
    const parsed = JSON.parse(value || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []);
  } catch {
    return new Set();
  }
}

function isCategoryComplete(category: GuardianRankTier["categories"][number]): boolean {
  return category.total > 0 && category.completed >= category.total;
}

function balanceCategoryColumns(
  categories: GuardianRankTier["categories"],
  collapsed: ReadonlySet<string>
): [GuardianRankTier["categories"], GuardianRankTier["categories"]] {
  if (categories.length === 1) return [[categories[0]!], []];
  const columns: [GuardianRankTier["categories"], GuardianRankTier["categories"]] = [[], []];
  const heights: [number, number] = [0, 0];
  const weighted = categories.map((category, index) => ({ category, index, height: categoryHeight(category, collapsed.has(category.nodeHash)) }))
    .sort((left, right) => right.height - left.height || left.index - right.index);
  weighted.forEach((entry, index) => {
    const column: 0 | 1 = index === 0 ? 1 : heights[0] <= heights[1] ? 0 : 1;
    columns[column].push(entry.category);
    heights[column] += entry.height;
  });
  return columns;
}

function categoryHeight(category: GuardianRankTier["categories"][number], collapsed: boolean): number {
  if (collapsed) return 1;
  return 1 + (category.description ? .35 : 0) + category.quests.reduce((height, quest) =>
    height + 1.4 + (quest.description ? .45 : 0) + Math.max(1, quest.objectives.length) * .55, 0);
}
