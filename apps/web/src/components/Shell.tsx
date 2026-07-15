import { Boxes, Coins, GitCompareArrows, ListTodo, Settings, ShieldEllipsis, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useGuardian } from "../state/GuardianContext";
import { OptionsPanel } from "./OptionsPanel";
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
                <div><span>Selected Guardian</span><strong>{guardian.displayName}</strong><small>{character?.className} · {character?.raceName}</small></div>
                {guardian.isInGame && <em>In game</em>}
              </>
            ) : (
              <div><span>Guardian Network</span><strong>{loading ? "Checking link…" : error ? "Link interrupted" : "Bungie not linked"}</strong></div>
            )}
          </div>
          <div className={styles.headerStats} aria-label="Guardian stats">
            <HeaderStat label="Power" value={guardian?.stats.power} symbol="✦" accent />
            <HeaderStat label="Guardian Rank" value={guardian?.stats.guardianRank} symbol="◆" />
            <HeaderStat label="Rewards Pass" value={guardian?.stats.rewardsPassRank} symbol="⬡" />
          </div>
          {!session?.authenticated && !loading && !error && <button className={styles.signIn} onClick={signIn}>Sign in with Bungie</button>}
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

function HeaderStat({ label, value, symbol, accent = false }: { label: string; value?: number; symbol: string; accent?: boolean }) {
  return <div className={`${styles.headerStat} ${accent ? styles.accentStat : ""}`}><i>{symbol}</i><span>{label}</span><strong>{value || "—"}</strong></div>;
}
