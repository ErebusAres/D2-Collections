import type { FireteamData, ReportAdminSummaryData, SiteLocale, SiteTextScale } from "@guardian-nexus/contracts";
import { Bug, ChevronRight, ClipboardList, Download, Eye, GitCompareArrows, LogOut, RefreshCcw, Trash2, Wrench, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, type RefObject } from "react";
import { api, mutationHeaders, queuedApi } from "../../services/api/client";
import { clearGuardianOfflineData } from "../../services/api/offlineCache";
import { LIVE_REFRESH_INTERVAL_SECONDS } from "../../services/liveRefresh";
import { pinsKey, useGuardian } from "../../context/GuardianContext";
import { trapFocusWithin } from "../common/focusTrap";
import styles from "./OptionsPanel.module.css";
import { SUPPORTED_LOCALES, useMessages, type MessageKey } from "../../modules/i18n/catalog";
import { parseTrackedBuilds } from "../../modules/buildAdvisor/buildTracking";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function OptionsPanel({ open, onClose, returnFocusRef, reportSummary }: { open: boolean; onClose: () => void; returnFocusRef?: RefObject<HTMLButtonElement | null>; reportSummary?: ReportAdminSummaryData }) {
  const guardianState = useGuardian();
  const text = useMessages(guardianState.locale);
  const translated = (key: MessageKey, fallback: string) => text?.[key] || fallback;
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const queryClient = useQueryClient();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const session = guardianState.session;
  const fireteam = useQuery({
    queryKey: ["fireteam", guardianState.selectedCharacterId],
    queryFn: () => api<FireteamData>(`/api/v1/fireteam?characterId=${encodeURIComponent(guardianState.selectedCharacterId)}`),
    enabled: Boolean(open && session?.authenticated && guardianState.selectedCharacterId),
    staleTime: 30_000
  });
  const setPersistentSharing = useMutation({
    mutationFn: (enabled: boolean) => {
      if (!enabled) return queuedApi("/api/v1/fireteam/share", { method: "DELETE", headers: mutationHeaders(session?.csrfToken) });
      let sitePinnedQuestIds: string[] = [];
      try { sitePinnedQuestIds = JSON.parse(localStorage.getItem(pinsKey(session?.guardian?.membershipId || "", guardianState.selectedCharacterId)) || "[]") as string[]; } catch { sitePinnedQuestIds = []; }
      let siteTrackedGuardianRankIds: string[] = [];
      try {
        const parsed = JSON.parse(guardianState.preferences["guardianRank.tracked"] || "[]");
        siteTrackedGuardianRankIds = Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, 200) : [];
      } catch { siteTrackedGuardianRankIds = []; }
      return queuedApi("/api/v1/fireteam/share", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ characterId: guardianState.selectedCharacterId, sitePinnedQuestIds, siteTrackedGuardianRankIds, siteTrackedBuilds: parseTrackedBuilds(guardianState.preferences["buildAdvisor.trackedBuilds.v1"]), mode: "persistent" }) });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["fireteam"] })
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
  useEffect(() => {
    const offerInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const clearInstall = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", offerInstall);
    window.addEventListener("appinstalled", clearInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", offerInstall);
      window.removeEventListener("appinstalled", clearInstall);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const hasAdminTools = Boolean(session?.roles.reportAdmin || session?.roles.dev || session?.roles.matrixWriter);

  return (
    <>
      <button className={`${styles.scrim} ${open ? styles.open : ""}`} onClick={() => { onClose(); returnFocusRef?.current?.focus(); }} aria-label="Dismiss options" tabIndex={open ? 0 : -1} />
      <aside ref={panelRef} className={`${styles.panel} ${open ? styles.open : ""}`} aria-hidden={!open} inert={!open} role="dialog" aria-modal={open ? "true" : undefined} aria-label="Guardian options">
        <header><div><span>{translated("settings", "Guardian settings")}</span><h2>{translated("options", "Options")}</h2></div><button ref={closeRef} onClick={() => { onClose(); returnFocusRef?.current?.focus(); }} aria-label="Close options"><X /></button></header>
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
          <h3>{translated("experience", "Experience")}</h3>
          <Toggle label={translated("autoRefresh", "Auto-refresh live data")} description={`Refresh visible live pages every ${LIVE_REFRESH_INTERVAL_SECONDS} seconds.`} checked={guardianState.autoRefresh} onChange={guardianState.setAutoRefresh} />
          <Toggle label={translated("reduceMotion", "Reduce motion")} description="Disable non-essential interface movement." checked={guardianState.reducedMotion} onChange={guardianState.setReducedMotion} />
          <Toggle label={translated("highContrast", "High contrast")} description="Increase text, border, focus, and status contrast." checked={Boolean(guardianState.highContrast)} onChange={guardianState.setHighContrast || (() => undefined)} />
          <label className={styles.toggle}><span><b>{translated("textSize", "Interface size")}</b><small>Enlarges the full Guardian Nexus interface, including text that uses fixed component sizing.</small></span><select value={guardianState.textScale || "standard"} onChange={(event) => guardianState.setTextScale?.(event.target.value as SiteTextScale)}><option value="standard">{translated("standard", "Standard")}</option><option value="large">{translated("large", "Large")}</option><option value="largest">{translated("largest", "Largest")}</option></select></label>
          <label className={styles.toggle}><span><b>{translated("language", "Core language preview")}</b><small>Currently translates navigation and these settings only. Page content and Bungie game data remain in English.</small></span><select value={guardianState.locale || "en-US"} onChange={(event) => guardianState.setLocale?.(event.target.value as SiteLocale)}>{SUPPORTED_LOCALES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
          {installPrompt && <button type="button" className={styles.installApp} onClick={() => void installApp()}><Download /><span><b>Install Guardian Nexus</b><small>Add the companion to this device for quicker access.</small></span></button>}
        </section>
        {session?.authenticated && <section>
          <h3>Fireteam privacy</h3>
          <Toggle label="Always share with friends" description={fireteam.data?.data.sharingMode === "persistent" ? "Background updates are active until you disable sharing or sign out." : "Keep a timestamped last-known snapshot visible to your current fireteam."} checked={fireteam.data?.data.sharingMode === "persistent"} onChange={(value) => setPersistentSharing.mutate(value)} />
        </section>}
        {hasAdminTools && <section className={styles.adminTools}>
          <h3>Admin tools</h3>
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

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.toggle}><span><b>{label}</b><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}
