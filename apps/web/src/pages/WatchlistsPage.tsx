import type { CollectionData, GearData, MailboxData, QuestData, RewardsPassData, WatchlistDocument, WatchlistEntry, WatchlistKind, XurData } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { BellRing, CircleCheck, CircleHelp, CircleX, Clock3, ExternalLink, Pause, Plus, Radar, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthGate, PageHeader } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { evaluateWatchlist, parseWatchlist, WATCHLIST_KINDS } from "../modules/watchlists/watchlists";
import { api } from "../services/api/client";
import styles from "./WatchlistsPage.module.css";

const notificationKey = (membershipId: string, entryId: string) => `guardian-nexus:${membershipId}:watch-alert:${entryId}`;

export function WatchlistsPage() {
  const { session, selectedCharacterId, preferences, setPreference, autoRefresh } = useGuardian();
  const document = useMemo(() => parseWatchlist(preferences["watchlists.v1"]), [preferences]);
  const [kind, setKind] = useState<WatchlistKind>("item");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [threshold, setThreshold] = useState(18);
  const [expiresAt, setExpiresAt] = useState("");
  const enabled = Boolean(session?.authenticated && selectedCharacterId);
  const refresh = autoRefresh ? 60_000 : false;
  const gear = useQuery({ queryKey: ["gear", selectedCharacterId], queryFn: () => api<GearData>(`/api/v1/me/gear?characterId=${encodeURIComponent(selectedCharacterId)}`), enabled, staleTime: 60_000, refetchInterval: refresh });
  const xur = useQuery({ queryKey: ["xur", selectedCharacterId], queryFn: () => api<XurData>(`/api/v1/me/xur?characterId=${encodeURIComponent(selectedCharacterId)}`), enabled, staleTime: 60_000, refetchInterval: refresh });
  const collection = useQuery({ queryKey: ["collection", selectedCharacterId], queryFn: () => api<CollectionData>(`/api/v1/me/collection?characterId=${encodeURIComponent(selectedCharacterId)}`), enabled, staleTime: 60_000, refetchInterval: refresh });
  const quests = useQuery({ queryKey: ["watchlist-quests", selectedCharacterId], queryFn: () => api<QuestData>(`/api/v1/me/quests?characterId=${encodeURIComponent(selectedCharacterId)}&pinned=`), enabled, staleTime: 60_000, refetchInterval: refresh });
  const rewards = useQuery({ queryKey: ["rewards", selectedCharacterId], queryFn: () => api<RewardsPassData>(`/api/v1/me/rewards?characterId=${encodeURIComponent(selectedCharacterId)}`), enabled, staleTime: 60_000, refetchInterval: refresh });
  const mailbox = useQuery({ queryKey: ["mailbox"], queryFn: () => api<MailboxData>("/api/v1/me/mailbox"), enabled, staleTime: 60_000, refetchInterval: refresh });
  const matches = useMemo(() => evaluateWatchlist(document, { gear: gear.data?.data, xur: xur.data?.data, collection: collection.data?.data, quests: quests.data?.data, rewards: rewards.data?.data, mailbox: mailbox.data?.data }), [collection.data, document, gear.data, mailbox.data, quests.data, rewards.data, xur.data]);
  const membershipId = session?.guardian?.membershipId || "";

  useEffect(() => {
    if (!membershipId || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const match of matches) {
      const watch = document.entries.find((entry) => entry.id === match.entryId);
      if (!watch?.notify || match.state !== "matched") continue;
      const key = notificationKey(membershipId, watch.id);
      const signature = `${match.summary}|${match.reason}`;
      if (localStorage.getItem(key) === signature) continue;
      new Notification(`Guardian Nexus · ${watch.label}`, { body: match.summary, tag: `watch-${watch.id}` });
      localStorage.setItem(key, signature);
    }
  }, [document.entries, matches, membershipId]);

  const save = (next: WatchlistDocument) => setPreference("watchlists.v1", JSON.stringify(next));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const displayLabel = label.trim() || target.trim() || "Postmaster capacity";
    if (!displayLabel || (kind !== "postmaster" && !target.trim()) || document.entries.length >= 50) return;
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `watch-${Date.now()}`;
    save({ schemaVersion: 1, entries: [...document.entries, { id, kind, label: displayLabel, target: target.trim(), threshold: kind === "postmaster" ? threshold : undefined, enabled: true, notify: true, resetAware: Boolean(expiresAt), expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined, createdAt: new Date().toISOString() }] });
    setLabel(""); setTarget(""); setExpiresAt("");
  };
  const patchEntry = (id: string, patch: Partial<WatchlistEntry>) => save({ schemaVersion: 1, entries: document.entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry) });
  const remove = (id: string) => save({ schemaVersion: 1, entries: document.entries.filter((entry) => entry.id !== id) });
  const requestAlerts = async () => { if (typeof Notification !== "undefined") await Notification.requestPermission(); };
  const loadingCount = [gear, xur, collection, quests, rewards, mailbox].filter((query) => query.isLoading).length;

  return <AuthGate>
    <PageHeader eyebrow="Private account monitoring" title="Watchlists" description="Track gear, perks, vendors, Collection unlocks, catalysts, pursuits, rewards, and Postmaster capacity from one membership-scoped workspace." actions={<button className={styles.alertButton} type="button" onClick={() => void requestAlerts()}><BellRing /> Enable browser alerts</button>} />
    <section className={styles.privacy}><Radar /><div><strong>Private by construction</strong><p>Watch definitions sync through your account preferences. Matches are calculated from private Guardian endpoints and are never written into shared snapshots.</p></div><span>{loadingCount ? `${loadingCount} sources syncing` : "All sources checked"}</span></section>
    <section className={styles.layout}>
      <form className={styles.creator} onSubmit={submit}>
        <header><Plus /><div><span>New watch</span><h2>Add a signal</h2></div></header>
        <label><span>Source</span><select value={kind} onChange={(event) => setKind(event.target.value as WatchlistKind)}>{WATCHLIST_KINDS.map((entry) => <option value={entry.kind} key={entry.kind}>{entry.label}</option>)}</select><small>{WATCHLIST_KINDS.find((entry) => entry.kind === kind)?.hint}</small></label>
        <label><span>Label <small>Optional</small></span><input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} placeholder="My chase" /></label>
        {kind !== "postmaster" && <label><span>Item, perk, or pursuit name</span><input value={target} onChange={(event) => setTarget(event.target.value)} maxLength={100} required placeholder="Type the Bungie name" /></label>}
        {kind === "postmaster" && <label><span>Alert at occupied slots</span><input type="number" min="1" max="21" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>}
        <label><span>Deadline <small>Optional, reset-aware</small></span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        <button type="submit" disabled={document.entries.length >= 50}><Plus /> Add watch</button>
        <p>{document.entries.length}/50 saved watches · alerts repeat only when the matched result changes.</p>
      </form>
      <section className={styles.board}>
        <header><div><span>Live evaluation</span><h2>{matches.filter((match) => match.state === "matched").length} matched signals</h2></div><b>{matches.length} total</b></header>
        {!document.entries.length && <div className={styles.empty}><Radar /><h3>No watches yet</h3><p>Add a source on the left. Guardian Nexus reports unknown data explicitly instead of guessing.</p></div>}
        <div className={styles.cards}>{document.entries.map((entry) => {
          const match = matches.find((candidate) => candidate.entryId === entry.id)!;
          const Icon = match.state === "matched" ? CircleCheck : match.state === "unknown" ? CircleHelp : match.state === "expired" ? Clock3 : entry.enabled ? CircleX : Pause;
          return <article key={entry.id} data-state={match.state}>
            <div className={styles.state}><Icon /><span>{match.state.replace("unmatched", "watching")}</span></div>
            <main><span>{WATCHLIST_KINDS.find((row) => row.kind === entry.kind)?.label} · {match.source}</span><h3>{entry.label}</h3><strong>{match.summary}</strong><p>{match.reason}</p>{entry.expiresAt && <small><Clock3 /> Deadline {new Date(entry.expiresAt).toLocaleString()}</small>}</main>
            <aside><button type="button" onClick={() => patchEntry(entry.id, { enabled: !entry.enabled })}>{entry.enabled ? "Pause" : "Resume"}</button><button type="button" aria-pressed={entry.notify} onClick={() => patchEntry(entry.id, { notify: !entry.notify })}><BellRing /> {entry.notify ? "Alerts on" : "Alerts off"}</button><Link to={match.destinationUrl}>Open source <ExternalLink /></Link><button type="button" className={styles.delete} aria-label={`Delete ${entry.label}`} onClick={() => remove(entry.id)}><Trash2 /></button></aside>
          </article>;
        })}</div>
      </section>
    </section>
  </AuthGate>;
}
