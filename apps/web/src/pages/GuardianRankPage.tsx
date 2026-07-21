import type { GuardianRankData, GuardianRankQuest, GuardianRankTier } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Check, CheckCircle2, CircleDashed, Compass, Crosshair, History, LockKeyhole, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import styles from "./GuardianRankPage.module.css";

type QuestFilter = "all" | "tracked" | "incomplete" | "complete";

export function GuardianRankPage() {
  const { session, selectedCharacterId, autoRefresh, preferences, setPreference } = useGuardian();
  const [selectedRankNumber, setSelectedRankNumber] = useState<number>();
  const [filter, setFilter] = useState<QuestFilter>("all");
  const [search, setSearch] = useState("");
  const result = useQuery({
    queryKey: ["guardian-rank", selectedCharacterId],
    queryFn: () => api<GuardianRankData>(`/api/v1/me/guardian-rank?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 60_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  useEffect(() => {
    if (data && selectedRankNumber === undefined) setSelectedRankNumber(data.suggestedRank);
  }, [data, selectedRankNumber]);
  const tracked = useMemo(() => parseTracked(preferences["guardianRank.tracked"]), [preferences]);
  const selectedRank = data?.ranks.find((rank) => rank.rankNumber === selectedRankNumber) || data?.ranks.find((rank) => rank.rankNumber === data.suggestedRank);
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
  const nextRank = data?.ranks.find((rank) => rank.rankNumber === data.currentRank + 1);

  const toggleTracked = (recordHash: string) => {
    const next = new Set(tracked);
    if (next.has(recordHash)) next.delete(recordHash); else next.add(recordHash);
    setPreference("guardianRank.tracked", JSON.stringify([...next]));
  };

  return <AuthGate>
    <PageHeader
      eyebrow="Guardian journey"
      title="Guardian Rank"
      description="Review every rank, inspect completed objectives, and track the exact Guardian Rank objectives Bungie reports for your account."
      actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />}
    />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.overview}>
        <div className={styles.currentMedallion}><ShieldCheck /><span>Current / renewed rank</span><strong>{data.currentRank}</strong></div>
        <div><span>Current journey</span><strong>{data.ranks.find((rank) => rank.rankNumber === data.currentRank)?.name || "Unavailable"}</strong><small>Seasonal renewedGuardianRank</small></div>
        <div><span>Next rank</span><strong>{nextRank ? `${nextRank.rankNumber} · ${nextRank.name}` : `${data.maximumRank} · Maximum`}</strong><small>{nextRank?.rankNumber === data.maximumRank ? `Highest achievable rank · no objectives beyond ${data.maximumRank}` : nextRank?.total ? `${nextRank.completed}/${nextRank.total} objectives complete` : "Maximum Guardian Rank achieved"}</small></div>
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
          <span>{rank.icon ? <img src={rank.icon} alt="" /> : <ShieldCheck />}</span>
          <b>{rank.rankNumber}</b>
          <small>{rank.name}</small>
          <em>{rank.state === "previous" ? <><Check /> Previous</> : rank.state === "current" ? "Current" : rank.state === "next" ? "Rank up" : <><LockKeyhole /> Future</>}</em>
        </button>)}
      </section>

      {selectedRank && <section className={styles.rankWorkspace}>
        <header className={styles.rankHero}>
          <div className={styles.rankArtwork} style={{ "--rank-art": selectedRank.foregroundImage ? `url(${selectedRank.foregroundImage})` : "none" } as React.CSSProperties}>
            {selectedRank.icon ? <img src={selectedRank.icon} alt="" /> : <ShieldCheck />}
            <strong>{selectedRank.rankNumber}</strong>
          </div>
          <div>
            <span>{rankEyebrow(selectedRank, data.currentRank, data.maximumRank)}</span>
            <h2>{selectedRank.name}</h2>
            <p>{selectedRank.description}</p>
          </div>
          <RankCompletion rank={selectedRank} currentRank={data.currentRank} maximumRank={data.maximumRank} />
        </header>

        <div className={styles.commandBar}>
          <label><Search /><input type="search" data-page-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rank objectives…" /></label>
          <div>{([[
            "all", "All", Compass
          ], ["tracked", "Tracked", Bookmark], ["incomplete", "Incomplete", CircleDashed], ["complete", "Complete", CheckCircle2]] as const).map(([value, label, Icon]) => <button key={value} className={filter === value ? styles.activeFilter : ""} onClick={() => setFilter(value)}><Icon />{label}</button>)}</div>
        </div>

        {visibleCategories.length ? <div className={styles.categoryGrid}>{visibleCategories.map((category) => <section className={styles.category} key={category.nodeHash}>
          <header><div>{category.icon ? <img src={category.icon} alt="" /> : <Sparkles />}</div><span><small>{category.seasonal ? "Seasonal objectives" : "Rank objectives"}</small><h3>{category.name}</h3></span><strong>{category.completed}/{category.total}</strong></header>
          {category.description && <p>{category.description}</p>}
          <div>{category.quests.map((quest) => <QuestCard key={quest.recordHash} quest={quest} tracked={tracked.has(quest.recordHash)} onTrack={() => toggleTracked(quest.recordHash)} />)}</div>
        </section>)}</div> : <section className={styles.empty}><History /><h2>{selectedRank.rankNumber === data.maximumRank ? "Maximum Guardian Rank" : "No objectives match this view"}</h2><p>{selectedRank.rankNumber === data.maximumRank ? `Rank ${data.maximumRank} is the highest achievable rank. There are no additional objectives after reaching it.` : selectedRank.total ? "Change the filter or search to see this rank's objectives." : "Bungie's current Guardian Rank definition contains no individual objectives for this rank."}</p></section>}
      </section>}
      <footer className={styles.sourceNote}>Current journey progress uses renewedGuardianRank when Bungie returns it. Highest achieved uses currentGuardianRank, and lifetime highest remains separate. Objective names and hierarchy come from Bungie's Guardian Rank manifest nodes; completion and counters come from live profile records. Missing record rows are shown as unavailable, not estimated.</footer>
    </>}
  </AuthGate>;
}

function QuestCard({ quest, tracked, onTrack }: { quest: GuardianRankQuest; tracked: boolean; onTrack: () => void }) {
  const status = quest.state === "completed" ? "Complete" : quest.state === "in-progress" ? "In progress" : quest.state === "not-started" ? "Not started" : "Progress unavailable";
  return <article className={`${styles.quest} ${styles[`quest-${quest.state}`]}`}>
    <header><span>{quest.icon ? <img src={quest.icon} alt="" /> : quest.state === "completed" ? <CheckCircle2 /> : <Crosshair />}</span><div><small>{status}{quest.trackedInDestiny ? " · Tracked in Destiny" : ""}</small><h4>{quest.name}</h4></div><button onClick={onTrack} className={tracked ? styles.tracked : ""} aria-label={tracked ? `Stop tracking ${quest.name}` : `Track ${quest.name}`} title={tracked ? "Stop tracking in Guardian Nexus" : "Track in Guardian Nexus"}><Bookmark fill={tracked ? "currentColor" : "none"} /></button></header>
    {quest.description && <p>{quest.description}</p>}
    <div className={styles.objectives}>{quest.objectives.length ? quest.objectives.map((objective) => <div key={objective.objectiveHash}>
      <span><b>{objective.name}</b><small>{objective.progressAvailable ? objective.completionValue > 0 ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}` : objective.complete ? "Complete" : "In progress" : "Bungie did not return a live counter"}</small></span>
      <i><span style={{ width: `${objective.percent}%` }} /></i>
      {objective.complete ? <CheckCircle2 /> : <strong>{objective.progressAvailable ? `${objective.percent}%` : "—"}</strong>}
    </div>) : <div className={styles.recordOnly}><span><b>{status}</b><small>This record has no separate numeric objective in the current manifest.</small></span></div>}</div>
  </article>;
}

function RankCompletion({ rank, currentRank, maximumRank }: { rank: GuardianRankTier; currentRank: number; maximumRank: number }) {
  if (rank.rankNumber === maximumRank) {
    const achieved = currentRank >= maximumRank;
    return <div className={styles.rankCompletion}><span>Rank ceiling</span><strong>{achieved ? "Maximum achieved" : `Rank ${maximumRank}`}</strong><i><span style={{ width: achieved ? "100%" : "0%" }} /></i><small>{achieved ? "Complete" : "No further objectives"}</small></div>;
  }
  const percent = rank.total ? Math.round((rank.completed / rank.total) * 100) : rank.state === "previous" || rank.state === "current" ? 100 : 0;
  return <div className={styles.rankCompletion}><span>Objective completion</span><strong>{rank.completed} / {rank.total}</strong><i><span style={{ width: `${percent}%` }} /></i><small>{percent}%</small></div>;
}

function rankEyebrow(rank: GuardianRankTier, currentRank: number, maximumRank: number): string {
  if (rank.rankNumber === maximumRank) return currentRank >= maximumRank ? "Maximum Guardian Rank achieved" : "Highest achievable Guardian Rank";
  if (rank.rankNumber < currentRank) return "Previous rank · completed journey";
  if (rank.rankNumber === currentRank) return "Current Guardian Rank";
  if (rank.rankNumber === currentRank + 1) return "Objectives required to rank up";
  return "Future Guardian Rank";
}

function parseTracked(value?: string): Set<string> {
  try {
    const parsed = JSON.parse(value || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []);
  } catch {
    return new Set();
  }
}
