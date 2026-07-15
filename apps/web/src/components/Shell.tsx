import { Badge, Boxes, Cloud, CloudOff, Coins, GitCompareArrows, ListTodo, Settings, ShieldEllipsis, Sparkles, Ticket, Users, Wrench } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { rewardLevelProgress } from "../rewardsProgress";
import { useGuardian } from "../state/GuardianContext";
import { OptionsPanel } from "./OptionsPanel";
import { getConnectionSnapshot, subscribeConnection } from "../api/client";
import styles from "./Shell.module.css";

const tabs = [
  { to: "/collection", label: "Collection", icon: Boxes },
  { to: "/xur", label: "Xûr", icon: Coins },
  { to: "/quests", label: "Quests", icon: ListTodo },
  { to: "/gear", label: "Gear", icon: ShieldEllipsis },
  { to: "/fireteam", label: "Fireteam", icon: Users },
  { to: "/matrix", label: "Guardian Matrix", icon: GitCompareArrows }
];

export function Shell() {
  const { session, loading, error, signIn } = useGuardian();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const connection = useSyncExternalStore(subscribeConnection, getConnectionSnapshot, getConnectionSnapshot);
  const guardian = session?.guardian;
  const character = guardian?.characters.find((entry) => entry.characterId === guardian.selectedCharacterId) || guardian?.characters[0];

  return (
    <div className={styles.shell} style={character?.emblemBackgroundPath ? { "--guardian-banner": `url(${character.emblemBackgroundPath})` } as React.CSSProperties : undefined}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.identityBar}>
          <NavLink to="/collection" className={styles.brand} aria-label="Guardian Nexus home">
            <span className={styles.brandMark}><span /></span>
            <span><b>Guardian</b><strong>Nexus</strong></span>
          </NavLink>
          <div className={styles.guardianIdentity}>
            {guardian ? (
              <>
                <img src={character?.emblemPath || ""} alt="" />
                <div className={styles.identityDetails}><span>Selected Guardian</span><strong>{guardian.displayName}</strong><small>{character?.className} · {character?.raceName}</small><div className={styles.identityStats} aria-label="Guardian stats"><HeaderStat label="Power" value={guardian.stats.power} icon={<Sparkles />} accent /><HeaderStat label="Guardian Rank" value={guardian.stats.guardianRank} icon={<Badge />} /><HeaderStat label="Rewards Pass" value={guardian.stats.rewardsPassProgress.state === "unavailable" && !guardian.stats.rewardsPassRank ? undefined : guardian.stats.rewardsPassRank} icon={<Ticket />} to="/rewards" actionLabel="View" /></div><RewardsProgress rank={guardian.stats.rewardsPassRank} progress={guardian.stats.rewardsPassProgress} /></div>
                {guardian.isInGame && <em>In game</em>}
              </>
            ) : (
              <div><span>Guardian Network</span><strong>{loading ? "Checking link…" : error ? "Link interrupted" : "Bungie not linked"}</strong></div>
            )}
          </div>
          {!session?.authenticated && !loading && !error && <button className={styles.signIn} onClick={signIn}>Sign in with Bungie</button>}
          <div className={`${styles.connectionStatus} ${error || connection.lastError ? styles.connectionInterrupted : ""}`} title={connection.queued ? `${connection.queued} request${connection.queued === 1 ? "" : "s"} queued. Guardian Nexus will retry automatically. ${connection.lastError || ""}` : error ? `${error.message} Displaying the last successful Guardian data.` : connection.lastError || "Guardian services connected."}>
            {error || connection.lastError ? <CloudOff size={17} /> : <Cloud size={17} />}{connection.queued > 0 && <b>{connection.queued}</b>}
          </div>
          <button className={styles.optionsButton} onClick={() => setOptionsOpen(true)} aria-label="Open options"><Settings size={20} /><span>Options</span></button>
        </div>
        <nav className={styles.tabs} aria-label="Guardian Nexus sections">
          {tabs.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? styles.activeTab : styles.tab}><Icon size={17} /><span>{label}</span></NavLink>)}
          {session?.roles.dev && <NavLink to="/dev" className={({ isActive }) => isActive ? styles.activeTab : styles.tab}><Wrench size={17} /><span>API Lab</span></NavLink>}
        </nav>
      </header>
      <main className={styles.main}><Outlet /></main>
      <footer className={styles.footer}><span>Guardian Nexus</span><span>Read-only Destiny companion</span><span>Activity data may be delayed</span></footer>
      <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} />
    </div>
  );
}

function HeaderStat({ label, value, icon, accent = false, to, actionLabel }: { label: string; value?: number | string; icon: React.ReactNode; accent?: boolean; to?: string; actionLabel?: string }) {
  const content = <><i>{icon}</i><span>{label}{actionLabel && <small className={styles.statLinkCue}>{actionLabel} ›</small>}</span><strong>{value ?? "—"}</strong></>;
  return to ? <NavLink to={to} className={`${styles.headerStat} ${styles.linkedStat} ${accent ? styles.accentStat : ""}`} aria-label={`Open ${label}`} title={`Open ${label}`}>{content}</NavLink> : <div className={`${styles.headerStat} ${accent ? styles.accentStat : ""}`}>{content}</div>;
}

function RewardsProgress({ rank, progress }: { rank: number; progress: import("@guardian-nexus/contracts").RewardsPassProgress }) {
  const levelProgress = rewardLevelProgress(progress);
  const label = levelProgress
    ? `${levelProgress.current.toLocaleString()} / ${levelProgress.required.toLocaleString()} XP · ${levelProgress.percent}% to rank ${rank + 1}`
    : progress.reason || "Rewards Pass XP is unavailable from Bungie.";
  return <NavLink to="/rewards" className={`${styles.rewardProgress} ${levelProgress ? "" : styles.rewardProgressUnavailable}`} title={`${label} · Open Rewards Pass`}><i><span style={{ width: `${levelProgress?.percent || 0}%` }} /></i><b>{levelProgress ? `${label} · Open pass →` : "XP unavailable · Open pass →"}</b></NavLink>;
}
