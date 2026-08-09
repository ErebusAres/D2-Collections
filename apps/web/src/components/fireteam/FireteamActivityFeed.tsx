import type { FireteamActivityFeed as FireteamActivityFeedData, FireteamActivityFeedEntry } from "@guardian-nexus/contracts";
import { ChevronDown, ChevronUp, Eye, EyeOff, MessageSquare, Pin, Send, Sparkles, UnfoldHorizontal } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ItemTooltip, TimelineEventTooltip } from "../gear/RecentLoot";
import styles from "./FireteamActivityFeed.module.css";

export type FireteamActivityFeedView = "open" | "minimized" | "hidden";
export type FireteamActivityWindowMode = "pinned" | "popout";

export interface FireteamActivityWindowState {
  mode: FireteamActivityWindowMode;
  x: number;
  y: number;
  width: number;
  height: number;
}

const WINDOW_GAP = 18;
const DEFAULT_WIDTH = 430;
const DEFAULT_HEIGHT = 560;
const MIN_WIDTH = 340;
const MIN_HEIGHT = 300;

export function FireteamActivityFeed({ feed, view, storageKey, onViewChange, onSend, sending, error, onDisable, onEnable }: {
  feed: FireteamActivityFeedData;
  view: FireteamActivityFeedView;
  storageKey?: string;
  onViewChange: (view: FireteamActivityFeedView) => void;
  onSend: (body: string) => void;
  sending: boolean;
  error?: string;
  onDisable: () => void;
  onEnable: () => void;
}) {
  const [body, setBody] = useState("");
  const [windowState, setWindowState] = useState(() => readWindowState(storageKey));
  const [dragging, setDragging] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const latestWindowState = useRef(windowState);
  const entries = [...feed.entries].reverse();

  useEffect(() => { latestWindowState.current = windowState; }, [windowState]);
  useEffect(() => { if (view === "open" && history.current) history.current.scrollTop = history.current.scrollHeight; }, [feed.entries.length, view]);
  useEffect(() => {
    const onResize = () => setWindowState((current) => {
      const next = clampActivityWindowState(current, window.innerWidth, window.innerHeight);
      persistWindowState(storageKey, next);
      return next;
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [storageKey]);
  useEffect(() => {
    if (view !== "open" || windowState.mode !== "popout" || !panel.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (!width || !height) return;
      setWindowState((current) => {
        if (Math.abs(current.width - width) < 2 && Math.abs(current.height - height) < 2) return current;
        const next = clampActivityWindowState({ ...current, width, height }, window.innerWidth, window.innerHeight);
        persistWindowState(storageKey, next);
        return next;
      });
    });
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [storageKey, view, windowState.mode]);

  if (view === "hidden") return <section className={styles.restore}><span><MessageSquare />Fireteam activity hidden</span><button type="button" onClick={() => onViewChange("open")}><Eye />Show</button></section>;

  const submit = (event: FormEvent) => { event.preventDefault(); const message = body.trim(); if (!message || sending || !feed.channelAvailable) return; onSend(message); setBody(""); };
  const saveWindowState = (next: FireteamActivityWindowState) => {
    const clamped = clampActivityWindowState(next, window.innerWidth, window.innerHeight);
    setWindowState(clamped);
    persistWindowState(storageKey, clamped);
  };
  const toggleWindowMode = () => {
    if (windowState.mode === "popout") saveWindowState({ ...windowState, mode: "pinned" });
    else saveWindowState({ ...defaultActivityWindowState(window.innerWidth, window.innerHeight), mode: "popout", width: windowState.width, height: windowState.height });
  };
  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (windowState.mode !== "popout" || event.button !== 0 || (event.target as HTMLElement).closest("button, input")) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: windowState.x, y: windowState.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const next = clampActivityWindowState({ ...latestWindowState.current, x: current.x + event.clientX - current.startX, y: current.y + event.clientY - current.startY }, window.innerWidth, window.innerHeight);
    latestWindowState.current = next;
    setWindowState(next);
  };
  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    drag.current = null;
    setDragging(false);
    persistWindowState(storageKey, latestWindowState.current);
  };
  const popoutStyle = windowState.mode === "popout" ? { left: windowState.x, top: windowState.y, width: windowState.width, height: windowState.height } : undefined;

  return <section ref={panel} className={styles.feed} data-disabled={!feed.enabled} data-view={view} data-window-mode={windowState.mode} data-dragging={dragging} style={popoutStyle}>
    <header onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
      <div><MessageSquare /><span><strong>Fireteam activity</strong><small>{feed.enabled ? `Current Fireteam only · ${feed.retentionDays}-day history` : "Sharing and messages are disabled"}</small></span></div><nav>
        {feed.enabled ? <button type="button" onClick={onDisable}>Disable</button> : <button type="button" onClick={onEnable}>Enable</button>}
        <button type="button" aria-label={windowState.mode === "pinned" ? "Pop out Fireteam activity" : "Pin Fireteam activity to bottom right"} title={windowState.mode === "pinned" ? "Move and resize" : "Pin to bottom right"} onClick={toggleWindowMode}>{windowState.mode === "pinned" ? <UnfoldHorizontal /> : <Pin />}</button>
        <button type="button" aria-label={view === "minimized" ? "Expand Fireteam activity" : "Minimize Fireteam activity"} onClick={() => onViewChange(view === "minimized" ? "open" : "minimized")}>{view === "minimized" ? <ChevronDown /> : <ChevronUp />}</button>
        <button type="button" aria-label="Hide Fireteam activity" onClick={() => onViewChange("hidden")}><EyeOff /></button>
      </nav>
    </header>
    {view === "open" && <>
      <div ref={history} className={styles.history} aria-live="polite">{!feed.enabled
        ? <p>Enable the activity feed to share recent gear finds and exchange short messages with synced members of your current Fireteam.</p>
        : entries.length ? entries.map((entry) => <ActivityLine key={`${entry.type}:${entry.id}`} entry={entry} />)
          : <p>{feed.channelAvailable ? "No recent Fireteam activity yet." : "When another current Fireteam member enables sharing, recent gear and messages will appear here."}</p>}</div>
      <form onSubmit={submit}><input aria-label="Message your Fireteam" value={body} maxLength={feed.messageMaxLength} onChange={(event) => setBody(event.target.value)} placeholder={feed.channelAvailable ? "Message your Fireteam…" : "Waiting for another synced Fireteam member"} disabled={!feed.enabled || !feed.channelAvailable || sending} /><span>{body.length}/{feed.messageMaxLength}</span><button type="submit" disabled={!body.trim() || !feed.channelAvailable || sending}><Send />Send</button>{error && <small className={styles.error} role="alert">{error}</small>}</form>
    </>}
  </section>;
}

export function defaultActivityWindowState(viewportWidth: number, viewportHeight: number): FireteamActivityWindowState {
  const width = Math.min(DEFAULT_WIDTH, Math.max(280, viewportWidth - WINDOW_GAP * 2));
  const height = Math.min(DEFAULT_HEIGHT, Math.max(240, viewportHeight - WINDOW_GAP * 2));
  return { mode: "pinned", x: Math.max(WINDOW_GAP, viewportWidth - width - WINDOW_GAP), y: Math.max(WINDOW_GAP, viewportHeight - height - WINDOW_GAP), width, height };
}

export function clampActivityWindowState(state: FireteamActivityWindowState, viewportWidth: number, viewportHeight: number): FireteamActivityWindowState {
  const maxWidth = Math.max(280, viewportWidth - WINDOW_GAP * 2);
  const maxHeight = Math.max(240, viewportHeight - WINDOW_GAP * 2);
  const width = Math.min(Math.max(Math.min(MIN_WIDTH, maxWidth), Number(state.width) || DEFAULT_WIDTH), maxWidth);
  const height = Math.min(Math.max(Math.min(MIN_HEIGHT, maxHeight), Number(state.height) || DEFAULT_HEIGHT), maxHeight);
  return {
    mode: state.mode === "popout" ? "popout" : "pinned",
    x: Math.min(Math.max(WINDOW_GAP, Number(state.x) || WINDOW_GAP), Math.max(WINDOW_GAP, viewportWidth - width - WINDOW_GAP)),
    y: Math.min(Math.max(WINDOW_GAP, Number(state.y) || WINDOW_GAP), Math.max(WINDOW_GAP, viewportHeight - height - WINDOW_GAP)),
    width,
    height
  };
}

export function parseActivityWindowState(value: string | null, viewportWidth: number, viewportHeight: number): FireteamActivityWindowState {
  try {
    const parsed = JSON.parse(value || "null");
    if (!parsed || typeof parsed !== "object") return defaultActivityWindowState(viewportWidth, viewportHeight);
    return clampActivityWindowState(parsed as FireteamActivityWindowState, viewportWidth, viewportHeight);
  } catch { return defaultActivityWindowState(viewportWidth, viewportHeight); }
}

function readWindowState(storageKey?: string): FireteamActivityWindowState {
  if (typeof window === "undefined") return defaultActivityWindowState(1280, 800);
  try { return parseActivityWindowState(storageKey ? localStorage.getItem(storageKey) : null, window.innerWidth, window.innerHeight); }
  catch { return defaultActivityWindowState(window.innerWidth, window.innerHeight); }
}

function persistWindowState(storageKey: string | undefined, state: FireteamActivityWindowState): void {
  if (!storageKey || typeof localStorage === "undefined") return;
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Preferences are best-effort on restricted browsers. */ }
}

function ActivityLine({ entry }: { entry: FireteamActivityFeedEntry }) {
  if (entry.type === "message") return <div className={styles.line}><strong>{entry.displayName}:</strong><span>{entry.body}</span><time dateTime={entry.createdAt}>{shortTime(entry.createdAt)}</time></div>;
  return <LootActivityLine entry={entry} />;
}

function LootActivityLine({ entry }: { entry: Extract<FireteamActivityFeedEntry, { type: "loot" }> }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const tooltipId = useId();
  const event = entry.event;
  const rarity = event.rarity || event.gear?.rarity || (event.kind.includes("catalyst") ? "Exotic" : "Common");
  const cancelClose = () => { if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current); closeTimer.current = undefined; };
  const show = () => { cancelClose(); setOpen(true); };
  const scheduleClose = () => { cancelClose(); closeTimer.current = window.setTimeout(() => setOpen(false), 120); };
  useEffect(() => () => cancelClose(), []);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!trigger.current || !tooltip.current) return;
      setPosition(activityTooltipPosition(trigger.current.getBoundingClientRect(), tooltip.current.getBoundingClientRect(), window.innerWidth, window.innerHeight));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    if (tooltip.current) observer?.observe(tooltip.current);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);
  return <div className={`${styles.line} ${styles.loot}`} onMouseEnter={show} onMouseLeave={scheduleClose} onFocus={show} onBlur={(focus) => { if (!focus.currentTarget.contains(focus.relatedTarget)) scheduleClose(); }} onKeyDown={(key) => { if (key.key === "Escape") setOpen(false); }} tabIndex={0}>
    <strong>{entry.displayName}:</strong><button ref={trigger} type="button" aria-describedby={open ? tooltipId : undefined} onClick={() => { cancelClose(); setOpen((value) => !value); }}>{event.icon ? <img className={styles.itemIcon} src={event.icon} alt="" /> : <Sparkles className={styles.itemIcon} />}<b data-rarity={rarity}>{event.name}</b><span>{event.quantity > 1 ? `×${event.quantity} found.` : "found."}</span></button><time dateTime={entry.createdAt}>{shortTime(entry.createdAt)}</time>
    {open && createPortal(<span ref={tooltip} className={styles.tooltip} style={position} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} onFocus={cancelClose} onBlur={scheduleClose}>{event.gear ? <ItemTooltip id={tooltipId} item={event.gear} /> : <TimelineEventTooltip id={tooltipId} event={event} />}</span>, document.body)}
  </div>;
}

export function activityTooltipPosition(anchor: Pick<DOMRect, "left" | "right" | "top">, overlay: Pick<DOMRect, "width" | "height">, viewportWidth: number, viewportHeight: number): { left: number; top: number } {
  const gap = 10;
  const edge = 12;
  const width = Math.min(overlay.width || 410, Math.max(0, viewportWidth - edge * 2));
  const height = Math.min(overlay.height || 360, Math.max(0, viewportHeight - edge * 2));
  const left = anchor.left - width - gap >= edge ? anchor.left - width - gap : Math.min(Math.max(edge, anchor.right + gap), Math.max(edge, viewportWidth - width - edge));
  const top = Math.min(Math.max(edge, anchor.top - 16), Math.max(edge, viewportHeight - height - edge));
  return { left: Math.round(left), top: Math.round(top) };
}

function shortTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
}
