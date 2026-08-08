import type { FireteamActivityFeed as FireteamActivityFeedData, FireteamActivityFeedEntry } from "@guardian-nexus/contracts";
import { ChevronDown, ChevronUp, Eye, EyeOff, MessageSquare, Send, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ItemTooltip, TimelineEventTooltip } from "../gear/RecentLoot";
import styles from "./FireteamActivityFeed.module.css";

export type FireteamActivityFeedView = "open" | "minimized" | "hidden";

export function FireteamActivityFeed({ feed, view, onViewChange, onSend, sending, error, onDisable, onEnable }: {
  feed: FireteamActivityFeedData;
  view: FireteamActivityFeedView;
  onViewChange: (view: FireteamActivityFeedView) => void;
  onSend: (body: string) => void;
  sending: boolean;
  error?: string;
  onDisable: () => void;
  onEnable: () => void;
}) {
  const [body, setBody] = useState("");
  const history = useRef<HTMLDivElement>(null);
  const entries = [...feed.entries].reverse();
  useEffect(() => { if (view === "open" && history.current) history.current.scrollTop = history.current.scrollHeight; }, [feed.entries.length, view]);
  if (view === "hidden") return <section className={styles.restore}><span><MessageSquare />Fireteam activity hidden</span><button type="button" onClick={() => onViewChange("open")}><Eye />Show</button></section>;
  const submit = (event: FormEvent) => { event.preventDefault(); const message = body.trim(); if (!message || sending || !feed.channelAvailable) return; onSend(message); setBody(""); };
  return <section className={styles.feed} data-disabled={!feed.enabled}>
    <header><div><MessageSquare /><span><strong>Fireteam activity</strong><small>{feed.enabled ? `Current Fireteam only · ${feed.retentionDays}-day history` : "Sharing and messages are disabled"}</small></span></div><nav>
      {feed.enabled ? <button type="button" onClick={onDisable}>Disable</button> : <button type="button" onClick={onEnable}>Enable</button>}
      <button type="button" aria-label={view === "minimized" ? "Expand Fireteam activity" : "Minimize Fireteam activity"} onClick={() => onViewChange(view === "minimized" ? "open" : "minimized")}>{view === "minimized" ? <ChevronDown /> : <ChevronUp />}</button>
      <button type="button" aria-label="Hide Fireteam activity" onClick={() => onViewChange("hidden")}><EyeOff /></button>
    </nav></header>
    {view === "open" && <>
      <div ref={history} className={styles.history} aria-live="polite">{!feed.enabled
        ? <p>Enable the activity feed to share recent gear finds and exchange short messages with synced members of your current Fireteam.</p>
        : entries.length ? entries.map((entry) => <ActivityLine key={`${entry.type}:${entry.id}`} entry={entry} />)
          : <p>{feed.channelAvailable ? "No recent Fireteam activity yet." : "When another current Fireteam member enables sharing, recent gear and messages will appear here."}</p>}</div>
      <form onSubmit={submit}><input aria-label="Message your Fireteam" value={body} maxLength={feed.messageMaxLength} onChange={(event) => setBody(event.target.value)} placeholder={feed.channelAvailable ? "Message your Fireteam…" : "Waiting for another synced Fireteam member"} disabled={!feed.enabled || !feed.channelAvailable || sending} /><span>{body.length}/{feed.messageMaxLength}</span><button type="submit" disabled={!body.trim() || !feed.channelAvailable || sending}><Send />Send</button>{error && <small className={styles.error} role="alert">{error}</small>}</form>
    </>}
  </section>;
}

function ActivityLine({ entry }: { entry: FireteamActivityFeedEntry }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  if (entry.type === "message") return <div className={styles.line}><strong>{entry.displayName}:</strong><span>{entry.body}</span><time dateTime={entry.createdAt}>{shortTime(entry.createdAt)}</time></div>;
  const event = entry.event;
  return <div className={`${styles.line} ${styles.loot}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={(focus) => { if (!focus.currentTarget.contains(focus.relatedTarget)) setOpen(false); }} onKeyDown={(key) => { if (key.key === "Escape") setOpen(false); }} tabIndex={0}>
    <strong>{entry.displayName}:</strong><button type="button" aria-describedby={open ? tooltipId : undefined} onClick={() => setOpen((value) => !value)}>{event.icon ? <img src={event.icon} alt="" /> : <Sparkles />}<b data-rarity={event.rarity || event.gear?.rarity || (event.kind.includes("catalyst") ? "Exotic" : undefined)}>{event.name}</b><span>{event.quantity > 1 ? `×${event.quantity} found.` : "found."}</span></button><time dateTime={entry.createdAt}>{shortTime(entry.createdAt)}</time>
    {open && <span className={styles.tooltip}>{event.gear ? <ItemTooltip id={tooltipId} item={event.gear} /> : <TimelineEventTooltip id={tooltipId} event={event} />}</span>}
  </div>;
}

function shortTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
}
