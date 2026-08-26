import type { ReportAdminSummaryData } from "@guardian-nexus/contracts";
import { Bug, ChevronRight, ClipboardList, Eye, GitCompareArrows, LogOut, RefreshCcw, Trash2, Wrench, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, type RefObject } from "react";
import { api, mutationHeaders, queuedApi } from "../../services/api/client";
import { clearGuardianOfflineData } from "../../services/api/offlineCache";
import { LIVE_REFRESH_INTERVAL_MINUTES } from "../../services/liveRefresh";
import { pinsKey, useGuardian } from "../../context/GuardianContext";
import { trapFocusWithin } from "../common/focusTrap";
import styles from "./OptionsPanel.module.css";
import { parseTrackedBuilds } from "../../modules/buildAdvisor/buildTracking";
import { useFireteamQuery } from "../../modules/fireteam/useFireteamQuery";

export function OptionsPanel({ open, onClose, returnFocusRef, reportSummary }: { open: boolean; onClose: () => void; returnFocusRef?: RefObject<HTMLButtonElement | null>; reportSummary?: ReportAdminSummaryData }) {
  const guardianState = useGuardian();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const queryClient = useQueryClient();
  const session = guardianState.session;
  const fireteam = useFireteamQuery(session?.guardian?.membershipId || "", guardianState.selectedCharacterId, Boolean(open && session?.authenticated), guardianState.autoRefresh);
  const setPersistentSharing = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!enabled) return queuedApi("/api/v2/fireteam/share", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) });
      const sitePinnedQuestIds = readLocalTrackedPreference(pinsKey(session?.guardian?.membershipId || "", guardianState.selectedCharacterId), 40);
      const siteTrackedGuardianRankIds = trackedPreference(guardianState.preferences["guardianRank.tracked"], 200);
      return queuedApi("/api/v2/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({
        characterId: guardianState.selectedCharacterId,
        sitePinnedQuestIds,
        siteTrackedGuardianRankIds,
        siteTrackedJourneyIds: trackedPreference(guardianState.preferences["journey.tracked"], 500),
        siteTrackedCollectionIds: trackedPreference(guardianState.preferences["collection.tracked"], 200),
        siteTrackedBuilds: parseTrackedBuilds(guardianState.preferences["buildAdvisor.trackedBuilds.v1"]),
        hiddenTrackedItemKeys: fireteam.data?.data.hiddenTrackedItemKeys || [],
        mode: "persistent"
      }) });
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["fireteam"] }),
      queryClient.invalidateQueries({ queryKey: ["fireteam-activity"] })
    ])
  });
  const setActivityFeed = useMutation({
    mutationFn: (enabled: boolean) => {
      const sitePinnedQuestIds = readLocalTrackedPreference(pinsKey(session?.guardian?.membershipId || "", guardianState.selectedCharacterId), 40);
      return queuedApi("/api/v2/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: guardianState.selectedCharacterId, sitePinnedQuestIds, mode: fireteam.data?.data.sharingMode === "temporary" ? "temporary" : "persistent", activityFeedEnabled: enabled }) });
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["fireteam"] }),
      queryClient.invalidateQueries({ queryKey: ["fireteam-activity"] })
    ])
  });
  const signOut = useMutation({
    mutationFn: () => api("/api/v1/session", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) }),
    onSuccess: () => {
      localStorage.removeItem("guardian-nexus:last-safe-session");
      void clearGuardianOfflineData().finally(() => { queryClient.clear(); window.location.href = "/director"; });
    }
  });
  const clearLocalData = async () => {
    Object.keys(localStorage).filter((key) => key.startsWith("guardian-nexus:")).forEach((key) => localStorage.removeItem(key));
    Object.keys(sessionStorage).filter((key) => key.startsWith("guardian-nexus:")).forEach((key) => sessionStorage.removeItem(key));
    await clearGuardianOfflineData();
    window.location.reload();
  };
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      trapFocusWithin(event, panelRef.current);
      if (event.key !== "Escape") return;
      onClose();
      returnFocusRef?.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open, returnFocusRef]);
  const hasAdminTools = Boolean(session?.roles.reportAdmin || session?.roles.dev || session?.roles.matrixWriter);

  return (
    <>
      <button className={`${styles.scrim} ${open ? styles.open : ""}`} onClick={() => { onClose(); returnFocusRef?.current?.focus(); }} aria-label="Dismiss options" tabIndex={open ? 0 : -1} />
      <aside ref={panelRef} className={`${styles.panel} ${open ? styles.open : ""}`} aria-hidden={!open} inert={!open} role="dialog" aria-modal={open ? "true" : undefined} aria-label="Guardian options">
        <header><div><span>Guardian settings</span><h2>Options</h2></div><button ref={closeRef} onClick={() => { onClose(); returnFocusRef?.current?.focus(); }} aria-label="Close options"><X /></button></header>
        <section>
          <h3>Selected Guardian</h3>
          <div className={styles.characters}>
            {session?.guardian?.characters.map((character) => (
              <button key={character.characterId} className={guardianState.selectedCharacterId === character.characterId ? styles.selected : ""} onClick={() => guardianState.selectCharacter(character.characterId)}>
                <img src={character.emblemPath} alt="" /><span><b>{character.className}</b><small>{character.power} Power</small></span>
              </button>
            )) || <p>Sign in to choose a character.</p>}
          </div>
        </section>
        <section>
          <h3>Experience</h3>
          <Toggle label="Auto-refresh live data" description={`Refresh visible live pages every ${LIVE_REFRESH_INTERVAL_MINUTES} minutes.`} checked={guardianState.autoRefresh} onChange={guardianState.setAutoRefresh} />
          <Toggle label="Reduce motion" description="Disable non-essential interface movement." checked={guardianState.reducedMotion} onChange={guardianState.setReducedMotion} />
          <Toggle label="High contrast" description="Increase text, border, focus, and status contrast." checked={Boolean(guardianState.highContrast)} onChange={guardianState.setHighContrast || (() => undefined)} />
        </section>
        {session?.authenticated && <section>
          <h3>Fireteam privacy</h3>
          <Toggle label="Always share with friends" description={fireteam.data?.data.sharingMode === "persistent" ? "Background updates are active until you disable sharing or sign out." : "Keep a timestamped last-known snapshot visible to your current fireteam."} checked={fireteam.data?.data.sharingMode === "persistent"} onChange={(value) => setPersistentSharing.mutate(value)} />
          <Toggle label="Fireteam activity feed" description="Share recent gear finds and exchange short messages only with synced members of your current Fireteam." checked={Boolean(fireteam.data?.data.activityFeedEnabled)} disabled={!fireteam.data?.data.sharingEnabled || setActivityFeed.isPending} onChange={(value) => setActivityFeed.mutate(value)} />
        </section>}
        {hasAdminTools && <section className={styles.adminTools}>
          <h3>Admin tools{session?.rolesState === "stale" ? " · Last verified" : ""}</h3>
          {session?.rolesState === "stale" && <p className={styles.adminState}>Live services are reconnecting. Access remains enforced by the server.</p>}
          <div>
            {session?.roles.reportAdmin && <Link className={styles.ticketQueue} to="/reports/admin" onClick={onClose}>
              <ClipboardList size={17} />
              <span><b>Ticket queue</b><small>{reportSummary ? `${reportSummary.counts.open} new · ${reportSummary.counts.in_progress} in progress` : "Loading…"}</small></span>
              <strong aria-label={`${reportSummary?.unresolvedCount ?? 0} unresolved tickets`}>{reportSummary?.unresolvedCount ?? 0}</strong>
              <ChevronRight size={14} />
            </Link>}
            {session?.roles.dev && <AdminLink to="/audience" label="Audience" icon={<Eye />} onClick={onClose} />}
            {session?.roles.dev && <AdminLink to="/dev" label="API Lab" icon={<Wrench />} onClick={onClose} />}
            {session?.roles.matrixWriter && <AdminLink to="/matrix" label="Matrix sync" icon={<GitCompareArrows />} onClick={onClose} />}
          </div>
        </section>}
        <section className={styles.actions}>
          <button onClick={() => void guardianState.refresh()}><RefreshCcw size={17} /> Refresh all data</button>
          <button onClick={() => void clearLocalData()}><Trash2 size={17} /> Clear local Guardian data</button>
          {session?.authenticated && <button className={styles.danger} onClick={() => signOut.mutate()} disabled={signOut.isPending}><LogOut size={17} /> Sign out</button>}
          <Link className={styles.feedback} to={`/reports?from=${encodeURIComponent(`${location.pathname}${location.search}`)}`} onClick={onClose}>
            <Bug size={17} /><span><b>Feedback &amp; reports</b><small>Report a bug or suggest an update</small></span><ChevronRight size={14} />
          </Link>
        </section>
      </aside>
    </>
  );
}

function AdminLink({ to, label, icon, onClick }: { to: string; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <Link to={to} onClick={onClick}>{icon}<b>{label}</b><ChevronRight size={13} /></Link>;
}

function Toggle({ label, description, checked, onChange, disabled = false }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className={styles.toggle}><span><b>{label}</b><small>{description}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}

function trackedPreference(value: string | undefined, limit: number): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, limit)
      : [];
  } catch {
    return [];
  }
}

function readLocalTrackedPreference(key: string, limit: number): string[] {
  try {
    return trackedPreference(localStorage.getItem(key) || undefined, limit);
  } catch {
    return [];
  }
}
