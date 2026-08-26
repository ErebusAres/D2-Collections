import type { RecentItemTimelineData, ReportAdminSummaryData, RewardsPassData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Badge, Boxes, Coins, Compass, Crosshair, Database, Globe2, Hammer, Layers3, ListTodo, Mail, Orbit, ScanSearch, Settings, ShieldEllipsis, Sparkles, Ticket, Users } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../../services/api/client";
import { hasClaimableReward, rewardLevelProgress } from "../../modules/rewards/rewardsProgress";
import { useGuardian } from "../../context/GuardianContext";
import { getConnectionSnapshot, subscribeConnection } from "../../services/api/client";
import { HEADER_REFRESH_INTERVAL_MS } from "../../services/liveRefresh";
import { GuardianFeed } from "../notifications/GuardianFeed";
import { NotificationCenter } from "../notifications/NotificationCenter";
import { useGuardianNotifications } from "../../modules/notifications/useGuardianNotifications";
import styles from "./Shell.module.css";

const OptionsPanel = lazy(() => import("./OptionsPanel").then((module) => ({ default: module.OptionsPanel })));
const ServiceIncidentBanner = lazy(() => import("./ServiceIncidentBanner").then((module) => ({ default: module.ServiceIncidentBanner })));

const tabs: Array<{ to: string; label: string; icon: typeof Globe2 }> = [
  { to: "/director", label: "Director", icon: Globe2 }, { to: "/collection", label: "Collection", icon: Boxes },
  { to: "/xur", label: "Xûr", icon: Coins }, { to: "/journey", label: "Journey", icon: ListTodo }, { to: "/gear", label: "Gear", icon: ShieldEllipsis },
  { to: "/loadouts", label: "Loadouts", icon: Layers3 }, { to: "/builds", label: "Builds", icon: Hammer }, { to: "/build-advisor", label: "Build Advisor", icon: ScanSearch },
  { to: "/fireteam", label: "Fireteam", icon: Users }
];

export function Shell() {
  const { session, loading, error, signIn, selectedCharacterId, autoRefresh } = useGuardian();
  const location = useLocation();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [copiedIncident, setCopiedIncident] = useState("");
  const [dismissedIncident, setDismissedIncident] = useState("");
  const optionsTriggerRef = useRef<HTMLButtonElement>(null);
  const connection = useSyncExternalStore(subscribeConnection, getConnectionSnapshot, getConnectionSnapshot);
  const guardian = session?.guardian;
  const character = guardian?.characters.find((entry) => entry.characterId === selectedCharacterId) || guardian?.characters[0];
  const rewards = useQuery({
    queryKey: ["rewards", selectedCharacterId],
    queryFn: () => api<RewardsPassData>(`/api/v1/me/rewards?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 60_000,
    refetchInterval: autoRefresh ? HEADER_REFRESH_INTERVAL_MS : false
  });
  useQuery({
    queryKey: ["recent-items", selectedCharacterId],
    queryFn: () => api<RecentItemTimelineData>(`/api/v1/me/recent-items?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId && !/^\/(fireteam|build-advisor)\/?$/.test(location.pathname)),
    staleTime: 30_000,
    refetchInterval: autoRefresh ? HEADER_REFRESH_INTERVAL_MS : false
  });
  const reportSummary = useQuery({
    queryKey: ["reports", "admin", "summary"],
    queryFn: () => api<ReportAdminSummaryData>("/api/v1/admin/reports/summary"),
    enabled: Boolean(session?.authenticated && session.roles.reportAdmin),
    staleTime: 30_000,
    refetchInterval: HEADER_REFRESH_INTERVAL_MS
  });
  const unresolvedTicketCount = reportSummary.data?.data.unresolvedCount ?? 0;
  const claimableReward = hasClaimableReward(rewards.data?.data.rewards);
  const liveRewards = rewards.data?.data;
  const rewardsPassRank = liveRewards?.rank ?? guardian?.stats.rewardsPassRank ?? 0;
  const rewardsPassProgress = liveRewards?.progress ?? guardian?.stats.rewardsPassProgress;
  const notifications = useGuardianNotifications();
  const showScrollTop = usePageUtilities();
  const savedDataLabel = connection.lastSavedAt ? `Showing saved data from ${new Date(connection.lastSavedAt).toLocaleString()}.` : "Showing the last saved Guardian data.";
  const connectionTitle = connection.queued
    ? `${connection.queued} safe change${connection.queued === 1 ? "" : "s"} queued for automatic retry. ${connection.lastError || ""}`
    : connection.usingSavedData
      ? `${savedDataLabel} Live services will refresh it automatically. ${connection.lastError || ""}`
      : error
        ? `${error.message} Displaying the last successful Guardian data where available.`
        : connection.lastError || "Guardian services connected.";

  return (
    <div className={styles.shell} style={character?.emblemBackgroundPath ? { "--guardian-banner": `url(${character.emblemBackgroundPath})` } as React.CSSProperties : undefined}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header} data-site-header>
        <GuardianFeed controller={notifications} />
        <div className={styles.identityBar}>
          <NavLink to="/director" className={styles.brand} aria-label="Guardian Nexus home">
            <span className={styles.brandMark}><span /></span>
            <span><b>Guardian</b><strong>Nexus</strong></span>
          </NavLink>
          <div className={styles.guardianIdentity}>
            {guardian ? (
              <>
                <img src={character?.emblemPath || ""} alt="" />
                <div className={styles.identityDetails}><span>Selected Guardian</span><strong>{guardian.displayName}</strong><small>{character?.className} · {character?.raceName}</small>{character?.emblemBackgroundPath && <div className={styles.guardianBanner} data-testid="guardian-banner" aria-hidden="true" />}<div className={styles.identityStats} aria-label="Guardian stats"><HeaderStat label="Light Level" value={guardian.stats.power} icon={<Sparkles />} accent to="/power" /><HeaderStat label="Guardian Rank" value={guardian.stats.guardianRank} icon={<Badge />} to="/journey/guardian-rank" /><HeaderStat label="Crucible Rank" value={guardian.stats.crucibleRank?.level} detail={guardian.stats.crucibleRank?.rankName} icon={<Crosshair />} to="/pvp" /><HeaderStat label="Rewards Pass" value={rewardsPassProgress?.state === "unavailable" && !rewardsPassRank ? undefined : rewardsPassRank} icon={<Ticket />} to="/rewards" claimable={claimableReward} /><HeaderStat label="Mailbox" value={guardian.stats.mailboxCount} icon={<Mail />} to="/mailbox" /><NavLink to="/next" className={styles.nextStepsStat} aria-label="Open personalized next steps" title="Not sure what to do? Open Next Steps"><i><Compass /></i><span><small>What next?</small><b>Find a goal</b></span></NavLink></div>{rewardsPassProgress && <RewardsProgress rank={rewardsPassRank} progress={rewardsPassProgress} />}</div>
                {guardian.isInGame && <em>In game</em>}
              </>
            ) : (
              <div><span>Guardian Network</span><strong>{loading ? "Checking link…" : error ? "Link interrupted" : "Bungie not linked"}</strong></div>
            )}
          </div>
          {!session?.authenticated && !loading && !error && <button className={styles.signIn} onClick={signIn}>Sign in with Bungie</button>}
          <NotificationCenter controller={notifications} />
          <button type="button" className={`${styles.connectionStatus} ${error || connection.lastError ? styles.connectionInterrupted : ""} ${connection.usingSavedData ? styles.connectionSaved : ""} ${connection.retrying ? styles.connectionWorking : ""}`} onClick={() => setOptionsOpen(true)} aria-label={connection.usingSavedData ? "Showing saved Guardian data. Open connection options" : error || connection.lastError ? "Guardian services interrupted. Open connection options" : "Guardian services connected. Open connection options"} title={connectionTitle}>
            {connection.usingSavedData ? <Database size={18} /> : <Orbit size={18} />}{connection.queued > 0 && <b>{connection.queued}</b>}
          </button>
          <button ref={optionsTriggerRef} className={`${styles.optionsButton} ${unresolvedTicketCount > 0 ? styles.optionsTicketAlert : ""}`} onClick={() => setOptionsOpen(true)} aria-label="Open options" title={unresolvedTicketCount > 0 ? `${unresolvedTicketCount} unresolved ticket${unresolvedTicketCount === 1 ? "" : "s"}` : "Options"}>
            <Settings size={20} /><span>Options</span>
            {session?.roles.reportAdmin && unresolvedTicketCount > 0 && <strong aria-label={`${unresolvedTicketCount} unresolved tickets`}>{unresolvedTicketCount}</strong>}
          </button>
        </div>
        <nav className={styles.tabs} aria-label="Guardian Nexus sections">
          {tabs.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? styles.activeTab : styles.tab}><Icon size={17} /><span>{label}</span></NavLink>)}
        </nav>
      </header>
      <main className={styles.main}><Outlet /></main>
      {connection.activeFailure && dismissedIncident !== incidentKey(connection.activeFailure) && <Suspense fallback={null}><ServiceIncidentBanner failure={connection.activeFailure} copied={copiedIncident === connection.activeFailure.requestId} onDismiss={() => setDismissedIncident(incidentKey(connection.activeFailure!))} onCopy={async () => {
          const { connectionFailureReport } = await import("../../services/api/incidentReport");
          await navigator.clipboard.writeText(connectionFailureReport(connection.activeFailure!));
          setCopiedIncident(connection.activeFailure?.requestId || connection.activeFailure?.occurredAt || "copied");
        }} /></Suspense>}
      {showScrollTop && <button type="button" className={styles.scrollTop} aria-label="Scroll to top" title="Scroll to top" onClick={() => window.scrollTo({ top: 0, behavior: document.documentElement.dataset.reducedMotion === "true" ? "auto" : "smooth" })}><ArrowUp /></button>}
      <footer className={styles.footer}><span>Guardian Nexus</span><span>Destiny companion</span><span>Activity data may be delayed</span></footer>
      <Suspense fallback={<aside aria-label="Guardian options" aria-hidden="true" inert />}>
        <OptionsPanel open={optionsOpen} onClose={() => setOptionsOpen(false)} returnFocusRef={optionsTriggerRef} reportSummary={reportSummary.data?.data} />
      </Suspense>
    </div>
  );
}

function incidentKey(failure: { requestId?: string; occurredAt: string }): string {
  return failure.requestId || failure.occurredAt;
}

function usePageUtilities(): boolean {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const updateScrollTop = () => setShowScrollTop(window.scrollY > 640 && document.documentElement.scrollHeight > window.innerHeight + 480);
    const focusPageSearch = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== "f") return;
      const search = Array.from(document.querySelectorAll<HTMLInputElement>("main input")).find((input) => !input.disabled && !input.closest('[aria-hidden="true"]') && (input.type === "search" || input.hasAttribute("data-page-search") || input.placeholder.toLocaleLowerCase().includes("search")));
      if (!search) return;
      event.preventDefault();
      search.focus();
      search.select();
    };

    updateScrollTop();
    window.addEventListener("scroll", updateScrollTop, { passive: true });
    window.addEventListener("resize", updateScrollTop);
    window.addEventListener("keydown", focusPageSearch);
    return () => {
      window.removeEventListener("scroll", updateScrollTop);
      window.removeEventListener("resize", updateScrollTop);
      window.removeEventListener("keydown", focusPageSearch);
    };
  }, []);

  return showScrollTop;
}

function HeaderStat({ label, value, detail, icon, accent = false, to, claimable = false }: { label: string; value?: number | string; detail?: string; icon: React.ReactNode; accent?: boolean; to?: string; claimable?: boolean }) {
  const tooltip = `${label}: ${value ?? "Unavailable"}${detail ? ` · ${detail}` : ""}${to ? " · Open" : ""}`;
  const className = `${styles.headerStat} ${to ? styles.linkedStat : ""} ${accent ? styles.accentStat : ""} ${claimable ? styles.claimableStat : ""}`;
  const content = <><i aria-hidden="true">{icon}</i><strong>{value ?? "—"}</strong></>;
  return to ? <NavLink to={to} className={className} data-tooltip={label} aria-label={tooltip} title={tooltip}>{content}</NavLink> : <div className={className} data-tooltip={label} aria-label={tooltip} title={tooltip}>{content}</div>;
}

function RewardsProgress({ rank, progress }: { rank: number; progress: import("@guardian-nexus/contracts").RewardsPassProgress }) {
  const levelProgress = rewardLevelProgress(progress);
  const completedSegments = levelProgress?.completedSegments ?? levelProgress?.segments?.filter((percent) => percent >= 100).length ?? 0;
  const totalSegments = levelProgress?.totalSegments ?? levelProgress?.segments?.length ?? 0;
  const label = levelProgress
    ? levelProgress.segments
      ? `${levelProgress.current.toLocaleString()} / ${levelProgress.required.toLocaleString()} XP toward rank ${rank + 1} · ${completedSegments}/${totalSegments} pips beyond rank ${rank}`
      : `${levelProgress.current.toLocaleString()} / ${levelProgress.required.toLocaleString()} XP · ${levelProgress.percent}% to rank ${rank + 1}`
    : progress.reason || "Rewards Pass XP is unavailable from Bungie.";
  const visibleLabel = levelProgress
    ? `${levelProgress.current.toLocaleString()} / ${levelProgress.required.toLocaleString()} XP (${levelProgress.percent}%)`
    : "XP unavailable";
  return <NavLink to="/rewards" className={`${styles.rewardProgress} ${levelProgress ? "" : styles.rewardProgressUnavailable}`} title={`${label} · Open Rewards Pass`}>
    {levelProgress?.segments
      ? <i className={styles.rewardProgressSegments}>{levelProgress.segments.map((percent, index) => <span key={index} style={{ "--segment-progress": `${percent}%` } as React.CSSProperties} />)}</i>
      : <i><span style={{ width: `${levelProgress?.percent || 0}%` }} /></i>}
    <b>{visibleLabel}</b>
  </NavLink>;
}
