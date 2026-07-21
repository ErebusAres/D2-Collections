import type { PvpData, PvpModeStats, PvpProgression, PvpProgressionKind } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Activity, Crosshair, Crown, Medal, RotateCcw, Shield, Swords, Target, Trophy } from "lucide-react";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { api } from "../services/api/client";
import styles from "./PvpPage.module.css";

const progressionLabels: Record<PvpProgressionKind, string> = {
  crucible: "Crucible reputation",
  competitive: "Competitive division",
  trials: "Trials reputation",
  "iron-banner": "Iron Banner reputation"
};

export function PvpPage() {
  const { session, selectedCharacterId, autoRefresh } = useGuardian();
  const result = useQuery({
    queryKey: ["pvp", selectedCharacterId],
    queryFn: () => api<PvpData>(`/api/v1/me/pvp?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 60_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  const rank = data?.primaryRank;

  return <AuthGate>
    <PageHeader
      eyebrow="Account-wide combat record"
      title="Crucible"
      description="Live Crucible reputation and account-wide PvP performance from Bungie's progression and historical-stat services."
      actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />}
    />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.hero}>
        <div className={styles.rankPanel}>
          <div className={styles.rankIcon}>{rank?.icon ? <img src={rank.icon} alt="" /> : <Crosshair />}</div>
          <div className={styles.rankIdentity}>
            <span>Crucible reputation</span>
            <h2>{rank?.rankName || "Rank unavailable"}</h2>
            <p>{rank ? <>Live rank {rank.level}{rank.resets ? <> · <RotateCcw /> {rank.resets} reset{rank.resets === 1 ? "" : "s"}</> : null}</> : "Bungie did not return a current Crucible progression for this account."}</p>
          </div>
          <RankProgress rank={rank} />
        </div>
        <div className={styles.snapshot} aria-label="Crucible career snapshot">
          <SnapshotStat label="Matches" value={data.hasActivity ? integer(data.overall.matches) : "—"} icon={<Swords />} />
          <SnapshotStat label="Wins" value={data.hasActivity ? integer(data.overall.wins) : "—"} icon={<Trophy />} />
          <SnapshotStat label="K/D" value={data.hasActivity ? decimal(data.overall.kd) : "—"} icon={<Target />} accent />
          <SnapshotStat label="Efficiency" value={data.hasActivity ? decimal(data.overall.efficiency) : "—"} icon={<Activity />} />
        </div>
      </section>

      {data.hasActivity ? <>
        <section className={styles.careerGrid} aria-label="Crucible career statistics">
          <CareerStat label="Win rate" value={`${decimal(data.overall.winRate)}%`} detail={`${integer(data.overall.wins)} wins across ${integer(data.overall.matches)} matches`} icon={<Trophy />} />
          <CareerStat label="Final blows" value={integer(data.overall.kills)} detail={`${integer(data.overall.deaths)} deaths · ${integer(data.overall.assists)} assists`} icon={<Crosshair />} />
          <CareerStat label="Precision final blows" value={integer(data.overall.precisionKills)} detail={`${integer(data.overall.bestSingleGameKills)} best single-game kills`} icon={<Target />} />
          <CareerStat label="Longest spree" value={integer(data.overall.longestKillSpree)} detail={data.overall.combatRating !== undefined ? `${decimal(data.overall.combatRating)} combat rating` : "Combat rating unavailable"} icon={<Medal />} />
        </section>
        <section className={styles.modeSection}>
          <header><div><span>Playlist breakdown</span><h2>Competitive arenas</h2></div><p>Mode totals are aggregated across every character on the linked Destiny account.</p></header>
          <div className={styles.modeGrid}>{data.modes.map((mode) => <ModeCard key={mode.kind} mode={mode} rank={progressionForMode(data.progressions, mode.kind)} />)}</div>
        </section>
      </> : <section className={styles.emptyHistory}>
        <Shield />
        <span>No Crucible history returned</span>
        <h2>This Guardian has no public PvP record yet</h2>
        <p>Bungie returned no historical Crucible matches for the linked account. Current rank data remains visible when Bungie provides it.</p>
      </section>}

      <section className={styles.rankSection}>
        <header><div><span>Live progression</span><h2>PvP ranks</h2></div><p>Only progression rows currently returned by Bungie are shown.</p></header>
        {data.progressions.length ? <div className={styles.rankGrid}>{data.progressions.map((entry) => <ProgressionCard key={entry.progressionHash} rank={entry} />)}</div> : <div className={styles.rankUnavailable}><Crown /><p>No current Crucible, Competitive, Trials, or Iron Banner progression was returned.</p></div>}
      </section>
      <footer className={styles.sourceNote}>Ranks use live character progressions and current manifest labels. Career totals use Bungie's historical-stat response; Guardian Nexus does not estimate missing activity.</footer>
    </>}
  </AuthGate>;
}

function RankProgress({ rank }: { rank?: PvpProgression }) {
  if (!rank?.nextLevelAt) return <div className={styles.rankProgressUnavailable}>Next-rank progress unavailable</div>;
  return <div className={styles.rankProgress}>
    <div><span>Next rank</span><strong>{integer(rank.progressToNextLevel)} / {integer(rank.nextLevelAt)}</strong></div>
    <i><span style={{ width: `${rank.percent || 0}%` }} /></i>
    <small>{rank.percent || 0}% complete</small>
  </div>;
}

function SnapshotStat({ label, value, icon, accent = false }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return <article className={accent ? styles.snapshotAccent : ""}>{icon}<span>{label}</span><strong>{value}</strong></article>;
}

function CareerStat({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <article>{icon}<div><span>{label}</span><strong>{value}</strong><p>{detail}</p></div></article>;
}

function ModeCard({ mode, rank }: { mode: PvpModeStats; rank?: PvpProgression }) {
  const icon = mode.kind === "trials" ? <Crown /> : mode.kind === "iron-banner" ? <Shield /> : <Medal />;
  return <article className={styles.modeCard}>
    <header>{icon}<div><span>{mode.name}</span><strong>{rank?.rankName || (mode.matches ? `${integer(mode.matches)} matches` : "No activity")}</strong></div></header>
    {mode.matches ? <div className={styles.modeStats}>
      <span><small>Matches</small><strong>{integer(mode.matches)}</strong></span>
      <span><small>Win rate</small><strong>{decimal(mode.winRate)}%</strong></span>
      <span><small>K/D</small><strong>{decimal(mode.kd)}</strong></span>
      <span><small>Efficiency</small><strong>{decimal(mode.efficiency)}</strong></span>
    </div> : <p>Bungie returned no historical matches for this playlist.</p>}
  </article>;
}

function ProgressionCard({ rank }: { rank: PvpProgression }) {
  return <article className={styles.progressionCard}>
    <div>{rank.icon ? <img src={rank.icon} alt="" /> : rank.kind === "trials" ? <Crown /> : rank.kind === "iron-banner" ? <Shield /> : <Crosshair />}</div>
    <span><small>{progressionLabels[rank.kind]}</small><strong>{rank.rankName}</strong><em>Live rank {rank.level}{rank.resets ? ` · ${rank.resets} reset${rank.resets === 1 ? "" : "s"}` : ""}</em></span>
    {rank.nextLevelAt ? <i><span style={{ width: `${rank.percent || 0}%` }} /></i> : null}
  </article>;
}

function progressionForMode(progressions: PvpProgression[], kind: PvpModeStats["kind"]): PvpProgression | undefined {
  if (kind === "all") return progressions.find((entry) => entry.kind === "crucible");
  return progressions.find((entry) => entry.kind === kind);
}

function integer(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString();
}

function decimal(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
