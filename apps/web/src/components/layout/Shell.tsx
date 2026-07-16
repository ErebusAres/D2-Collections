import type { RewardsPassData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { Badge, Boxes, Coins, Gift, GitCompareArrows, Layers3, ListTodo, Mail, Orbit, Settings, ShieldEllipsis, Sparkles, Ticket, Users, Wrench } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../../services/api/client";
import { hasClaimableReward, rewardLevelProgress } from "../../modules/rewards/rewardsProgress";
import { activeRewardCodes } from "../../modules/reward-codes/rewardCodes";
import { useRewardCodeStatus } from "../../modules/reward-codes/rewardCodeStatus";
import { useGuardian } from "../../context/GuardianContext";
import { OptionsPanel } from "./OptionsPanel";
import { RewardCodeMarquee } from "../reward-codes/RewardCodeMarquee";
import { getConnectionSnapshot, subscribeConnection } from "../../services/api/client";
import styles from "./Shell.module.css";

const tabs = [
  { to: "/collection", label: "Collection", icon: Boxes },
  { to: "/xur", label: "Xûr", icon: Coins },
  { to: "/quests", label: "Quests", icon: ListTodo },
  { to: "/gear", label: "Gear", icon: ShieldEllipsis },
  { to: "/loadouts", label: "Loadouts", icon: Layers3 },
  { to: "/fireteam", label: "Fireteam", icon: Users },
  { to: "/matrix", label: "Guardian Matrix", icon: GitCompareArrows }
];

export function Shell() {
  const { session, loading, error, signIn, selectedCharacterId, autoRefresh } = useGuardian();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const connection = useSyncExternalStore(subscribeConnection, getConnectionSnapshot, getConnectionSnapshot);
  const guardian = session?.guardian;
  const character = guardian?.characters.find((entry) => entry.characterId === guardian.selectedCharacterId) || guardian?.characters[0];
  const rewards = useQuery({
    queryKey: ["rewards", selectedCharacterId],
    queryFn: () => api<RewardsPassData>(`/api/v1/me/rewards?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 60_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const claimableReward = hasClaimableReward(rewards.data?.data.rewards);
  const { hidden: hiddenRewardCodes } = useRewardCodeStatus(guardian?.membershipId, Boolean(session?.authenticated), autoRefresh);
  const availableRewardCodeCount = activeRewardCodes().filter((entry) => !hiddenRewardCodes.has(entry.code)).length;

  return (
    <div className={styles.shell} style={character?.emblemBackgroundPath ? { "--guardian-banner": `url(${character.emblemBackgroundPath})` } as React.CSSProperties : undefined}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}>
        <RewardCodeMarquee />
        <div className={styles.identityBar}>
          <NavLink to="/collection" className={styles.brand} aria-label="Guardian Nexus home">
            <span className={styles.brandMark}><span /></span>
            <span><b>Guardian</b><strong>Nexus</strong></span>
          </NavLink>
          <div className={styles.guardianIdentity}>
            {guardian ? (
              <>
                <img src={character?.emblemPath || ""} alt="" />
                <div className={styles.identityDetails}><span>Selected Guardian</span><strong>{guardian.displayName}</strong><small>{character?.className} · {character?.raceName}</small>{character?.emblemBackgroundPath && <div className={styles.guardianBanner} data-testid="guardian-banner" aria-hidden="true" />}<div className={styles.identityStats} aria-label="Guardian stats"><HeaderStat label="Light Level" value={guardian.stats.power} icon={<Sparkles />} accent /><HeaderStat label="Guardian Rank" value={guardian.stats.guardianRank} icon={<Badge />} /><HeaderStat label="Rewards Pass" value={guardian.stats.rewardsPassProgress.state === "unavailable" && !guardian.stats.rewardsPassRank ? undefined : guardian.stats.rewardsPassRank} icon={<Ticket />} to="/rewards" claimable={claimableReward} /><HeaderStat label="Mailbox" value={guardian.stats.mailboxCount} icon={<Mail />} to="/mailbox" /><HeaderStat label="Reward Codes" value={availableRewardCodeCount} icon={<Gift />} to="/codes" claimable={availableRewardCodeCount > 0} /></div><RewardsProgress rank={guardian.stats.rewardsPassRank} progress={guardian.stats.rewardsPassProgress} /></div>
                {guardian.isInGame && <em>In game</em>}
              </>
            ) : (
              <div><span>Guardian Network</span><strong>{loading ? "Checking link…" : error ? "Link interrupted" : "Bungie not linked"}</strong></div>
            )}
          </div>
          {!session?.authenticated && !loading && !error && <button className={styles.signIn} onClick={signIn}>Sign in with Bungie</button>}
          <div className={`${styles.connectionStatus} ${error || connection.lastError ? styles.connectionInterrupted : ""} ${connection.retrying ? styles.connectionWorking : ""}`} aria-label={error || connection.lastError ? "Guardian services interrupted" : "Guardian services connected"} title={connection.queued ? `${connection.queued} request${connection.queued === 1 ? "" : "s"} queued. Guardian Nexus will retry automatically. ${connection.lastError || ""}` : error ? `${error.message} Displaying the last successful Guardian data.` : connection.lastError || "Guardian services connected."}>
            <Orbit size={18} />{connection.queued > 0 && <b>{connection.queued}</b>}
          </div>
          <button className={styles.optionsButton} onClick={() => setOptionsOpen(true)} aria-label="Open options"><Settings size={20} /><span>Options</span></button>
        </div>
        <nav className={styles.tabs} aria-label="Guardian Nexus sections">
          {tabs.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? styles.activeTab : styles.tab}><Icon size={17} /><span>{label}</span></NavLink>)}
          {session?.roles.dev && <NavLink to="/dev" className={({ isActive }) => isActive ? styles.activeTab : styles.tab}><Wrench size={17} /><span>API Lab</span></NavLink>}
        </nav>
      </header>
      <main className={styles.main}><Outlet /></main>
      <footer className={styles.footer}><span>Guardian Nexus</span><span>Destiny companion</span><span>Activity data may be delayed</span></footer>
      <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} />
    </div>
  );
}

function HeaderStat({ label, value, icon, accent = false, to, claimable = false }: { label: string; value?: number | string; icon: React.ReactNode; accent?: boolean; to?: string; claimable?: boolean }) {
  const tooltip = `${label}: ${value ?? "Unavailable"}${to ? " · Open" : ""}`;
  const className = `${styles.headerStat} ${to ? styles.linkedStat : ""} ${accent ? styles.accentStat : ""} ${claimable ? styles.claimableStat : ""}`;
  const content = <><i aria-hidden="true">{icon}</i><strong>{value ?? "—"}</strong></>;
  return to ? <NavLink to={to} className={className} data-tooltip={label} aria-label={tooltip} title={tooltip}>{content}</NavLink> : <div className={className} data-tooltip={label} aria-label={tooltip} title={tooltip}>{content}</div>;
}

function RewardsProgress({ rank, progress }: { rank: number; progress: import("@guardian-nexus/contracts").RewardsPassProgress }) {
  const levelProgress = rewardLevelProgress(progress);
  const label = levelProgress
    ? `${levelProgress.current.toLocaleString()} / ${levelProgress.required.toLocaleString()} XP · ${levelProgress.percent}% to rank ${rank + 1}`
    : progress.reason || "Rewards Pass XP is unavailable from Bungie.";
  return <NavLink to="/rewards" className={`${styles.rewardProgress} ${levelProgress ? "" : styles.rewardProgressUnavailable}`} title={`${label} · Open Rewards Pass`}><i><span style={{ width: `${levelProgress?.percent || 0}%` }} /></i><b>{levelProgress ? `${label} · Open pass →` : "XP unavailable · Open pass →"}</b></NavLink>;
}
