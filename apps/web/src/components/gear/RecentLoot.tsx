import type { ArmorItem, ArmorPerk, GearTag, LootWatcherConfig, RecentItemEvent, WeaponItem } from "@guardian-nexus/contracts";
import { Archive, BarChart3, Check, ChevronLeft, ChevronRight, Clock3, ExternalLink, Inbox, LockKeyhole, PackageOpen, Shield, ShieldCheck, Sparkles, Tags, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { evaluateWeapon, qualityLabel } from "../../modules/loot/weaponEvaluator";
import { useResolvedWeaponRatings } from "../../modules/loot/useResolvedWeaponRatings";
import { GearTagPicker } from "./GearTagPicker";
import { GearTierRail } from "./GearTierRail";
import { WeaponRatingPanel } from "./WeaponRatingPanel";
import styles from "./RecentLoot.module.css";

export type LootItem = ({ kind: "armor" } & ArmorItem) | ({ kind: "weapon" } & WeaponItem);
export type RecentLootDisplayLimit = 12 | 24 | 48;
export interface RecentCatalystObservation { recordHash: string; name: string; icon: string; state: "obtained" | "complete"; percent: number; observedAt: string }
type LegacyRecentEntry = { kind: "gear"; observedAt: string; item: LootItem } | { kind: "catalyst"; observedAt: string; catalyst: RecentCatalystObservation };
export type WeaponSocketChange = (item: WeaponItem, socketIndex: number, plugItemHash: string) => void;
export type LootPull = (item: LootItem) => void;
const SHORTCUT_TAGS: Record<string, GearTag> = { "1": "favorite", "2": "keep", "3": "junk", "4": "archive", "5": "infuse" };
const DISPLAY_LIMITS: RecentLootDisplayLimit[] = [12, 24, 48];

export function recentLoot(armor: ArmorItem[], weapons: WeaponItem[], kind: "all" | "armor" | "weapon" = "all", limit = 30): LootItem[] {
  return gearLootItems(armor, weapons, kind)
    .filter((item) => item.isNew).sort(byNewest).slice(0, limit);
}

export function observedLootWithin(armor: ArmorItem[], weapons: WeaponItem[], days: number, kind: "all" | "armor" | "weapon" = "all", now = Date.now()): LootItem[] {
  const earliest = now - Math.max(1, days) * 24 * 60 * 60_000;
  return gearLootItems(armor, weapons, kind).filter((item) => {
    const observedAt = Date.parse(item.firstSeenAt);
    return Number.isFinite(observedAt) && observedAt >= earliest && observedAt <= now;
  }).sort(byNewest);
}

export function gearLootItems(armor: ArmorItem[], weapons: WeaponItem[], kind: "all" | "armor" | "weapon" = "all"): LootItem[] {
  return [
    ...(kind !== "weapon" ? armor.map((item) => ({ ...item, kind: "armor" as const })) : []),
    ...(kind !== "armor" ? weapons.map((item) => ({ ...item, kind: "weapon" as const })) : [])
  ];
}

export function RecentItemRow({ title, items, onTag, onSocketChange, busy = false, empty = "No newly observed items." }: { title: string; items: LootItem[]; onTag: (item: LootItem, tag?: GearTag) => void; onSocketChange?: WeaponSocketChange; busy?: boolean; empty?: string }) {
  const active = useRef<LootItem | undefined>(undefined);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const tag = event.shiftKey ? SHORTCUT_TAGS[event.key] : undefined;
      if (!tag || !active.current || isTyping(event.target)) return;
      event.preventDefault(); onTag(active.current, tag);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [onTag]);
  return <section className={styles.row}><header><Sparkles /><span><strong>{title}</strong><small>{items.length} new · first observed by Guardian Nexus</small></span></header>{items.length ? <div>{items.map((item) => <RecentItemCard key={item.instanceId} item={item} onActivate={() => { active.current = item; }} onDeactivate={() => { if (active.current?.instanceId === item.instanceId) active.current = undefined; }} onTag={(tag) => onTag(item, tag)} onSocketChange={onSocketChange} busy={busy} />)}</div> : <p>{empty}</p>}</section>;
}

export function LootHistoryGrid({ title, subtitle, items, onTag, onPull, onSocketChange, busy = false, empty, itemActions }: { title: string; subtitle: string; items: LootItem[]; onTag: (item: LootItem, tag?: GearTag) => void; onPull?: LootPull; onSocketChange?: WeaponSocketChange; busy?: boolean; empty: string; itemActions?: (item: LootItem) => ReactNode }) {
  const active = useRef<LootItem | undefined>(undefined);
  useLootShortcuts(active, onTag, onPull, busy);
  return <section className={styles.history}><header><span><strong>{title}</strong><small>{subtitle}</small></span><b>{items.length}</b></header>{items.length ? <div>{items.map((item) => <RecentItemCard key={item.instanceId} item={item} onActivate={() => { active.current = item; }} onDeactivate={() => { if (active.current?.instanceId === item.instanceId) active.current = undefined; }} onTag={(tag) => onTag(item, tag)} onSocketChange={onSocketChange} busy={busy} pullShortcut={Boolean(onPull)} actions={itemActions?.(item)} />)}</div> : <p>{empty}</p>}</section>;
}

export function parseRecentLootDisplayLimit(value?: string): RecentLootDisplayLimit {
  if (value === "12" || value === "48") return Number(value) as 12 | 48;
  return 24;
}

export function recentLootPageSize(width: number): number {
  return Math.max(1, Math.floor(Math.max(0, width) / 89));
}

export function RecentEventRow({ title, subtitle, events, onTag, onPull, onSocketChange, busy = false, empty = "No observed items in this period." }: { title: string; subtitle: string; events: RecentItemEvent[]; onTag: (item: LootItem, tag?: GearTag) => void; onPull?: LootPull; onSocketChange?: WeaponSocketChange; busy?: boolean; empty?: string }) {
  const active = useRef<LootItem | undefined>(undefined);
  const viewport = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(0);
  useLootShortcuts(active, onTag, onPull, busy);
  const visible = [...events].sort((left, right) => Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt));
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageEntries = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  useEffect(() => {
    const update = () => {
      const width = viewport.current?.clientWidth || 0;
      if (width > 0) setPageSize(recentLootPageSize(width));
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    if (viewport.current) observer?.observe(viewport.current);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  useEffect(() => setPage((value) => Math.min(value, pageCount - 1)), [pageCount]);
  const newestMarker = visible[0] ? `${visible[0].id}:${visible[0].lastObservedAt}` : "";
  useEffect(() => setPage(0), [newestMarker]);
  return <section className={styles.eventRow} data-event-row={title}>
    <header><span><strong>{title}</strong><small>{subtitle}</small></span><b>{visible.length}</b></header>
    <div className={styles.carousel}><button type="button" aria-label={`Previous ${title} page`} onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={currentPage === 0}><ChevronLeft /></button><div className={styles.carouselViewport} ref={viewport}><div className={styles.carouselPage}>{pageEntries.length ? pageEntries.map((event) => <TimelineEventCard key={event.id} event={event} active={active} onTag={onTag} onSocketChange={onSocketChange} busy={busy} pullShortcut={Boolean(onPull)} />) : <p>{empty}</p>}</div></div><span className={styles.pageCount}>{currentPage + 1} / {pageCount}</span><button type="button" aria-label={`Next ${title} page`} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={currentPage >= pageCount - 1}><ChevronRight /></button></div>
  </section>;
}

export function CompactRecentLootBar({ events, items = [], catalysts = [], displayLimit = 24, onDisplayLimitChange, onTag, onPull, onSocketChange, busy = false, onHide, loading = false, error, warnings = [], retentionDays, observedAt, firstObservationEstablished = false, onRetry, watchers, onWatcherChange, watcherBusy = false, watcherStatus }: { events?: RecentItemEvent[]; items?: LootItem[]; catalysts?: RecentCatalystObservation[]; displayLimit?: RecentLootDisplayLimit; onDisplayLimitChange?: (limit: RecentLootDisplayLimit) => void; onTag: (item: LootItem, tag?: GearTag) => void; onPull?: LootPull; onSocketChange?: WeaponSocketChange; busy?: boolean; onHide: () => void; loading?: boolean; error?: Error | null; warnings?: string[]; retentionDays?: number; observedAt?: string; firstObservationEstablished?: boolean; onRetry?: () => void; watchers?: LootWatcherConfig; onWatcherChange?: (key: keyof LootWatcherConfig, enabled: boolean) => void; watcherBusy?: boolean; watcherStatus?: string }) {
  const active = useRef<LootItem | undefined>(undefined);
  const viewport = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(0);
  useLootShortcuts(active, onTag, onPull, busy);
  const gearEntries = items.map((item) => ({ kind: "gear" as const, observedAt: item.firstSeenAt, item }));
  const catalystEntries = catalysts.map((catalyst) => ({ kind: "catalyst" as const, observedAt: catalyst.observedAt, catalyst }));
  const entries = [...gearEntries, ...catalystEntries];
  const reservedCatalysts = gearEntries.length && catalystEntries.length ? Math.min(catalystEntries.length, Math.max(1, Math.floor(displayLimit / 4))) : catalystEntries.length;
  const selectedGear = gearEntries.slice(0, displayLimit - reservedCatalysts);
  const legacyVisible = [...selectedGear, ...catalystEntries.slice(0, displayLimit - selectedGear.length)].sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt));
  const visible = events ? [...events].sort((left, right) => Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt)) : legacyVisible;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageEntries: unknown[] = visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const renderEntry = (entry: unknown) => {
    if (events) {
      const event = entry as RecentItemEvent;
      return <TimelineEventCard key={event.id} event={event} active={active} onTag={onTag} onSocketChange={onSocketChange} busy={busy} pullShortcut={Boolean(onPull)} />;
    }
    const legacy = entry as LegacyRecentEntry;
    return legacy.kind === "gear"
      ? <RecentItemCard compact key={`gear-${legacy.item.instanceId}`} item={legacy.item} onActivate={() => { active.current = legacy.item; }} onDeactivate={() => { if (active.current?.instanceId === legacy.item.instanceId) active.current = undefined; }} onTag={(tag) => onTag(legacy.item, tag)} onSocketChange={onSocketChange} busy={busy} pullShortcut={Boolean(onPull)} />
      : <RecentCatalystCard key={`catalyst-${legacy.catalyst.recordHash}`} catalyst={legacy.catalyst} />;
  };
  useEffect(() => {
    const update = () => {
      const width = viewport.current?.clientWidth || 0;
      if (width > 0) setPageSize(recentLootPageSize(width));
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(update);
    if (viewport.current) observer?.observe(viewport.current);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  useEffect(() => setPage((value) => Math.min(value, pageCount - 1)), [pageCount]);
  const newestMarker = events?.[0] ? `${events[0].id}:${events[0].lastObservedAt}` : "";
  useEffect(() => setPage(0), [newestMarker]);
  const emptyMessage = loading
    ? "Checking your latest Bungie profile snapshot…"
    : error
      ? error.message
      : firstObservationEstablished
        ? "Private baseline established. New observed changes will appear here."
        : "No item changes have been observed yet.";
  const watcherButtons = [
    ["farmingMode", "Farming Mode", "Keep one inventory slot free in each weapon and armor bucket by moving unprotected gear to the vault.", PackageOpen],
    ["highestPowerLock", "Highest Power", "Instantly lock newly looted weapons or armor when their Power is higher than every item already owned in that slot.", LockKeyhole],
    ["tier5FitLock", "Tier 5 fits", "Instantly lock newly looted Tier 5 non-Exotic armor when its piece, archetype, and bonus-stat combination is not already owned at Tier 5.", ShieldCheck],
    ["duplicateFitJunk", "Duplicate fits", "Tag newly looted inferior duplicate or invalid-fit non-Exotic armor as junk. Equipped, locked, and already tagged pieces are skipped.", Tags]
  ] as const;
  return <section className={styles.compactBar}>
    <header><span className={styles.compactTitle}><Sparkles /><strong>Recent loot</strong></span>{watchers && onWatcherChange && <nav className={styles.lootWatchers} aria-label="Recent Loot watchers">{watcherButtons.map(([key, label, description, Icon]) => <button key={key} type="button" aria-label={`${label} watcher ${watchers[key] ? "on" : "off"}`} aria-pressed={watchers[key]} data-active={watchers[key]} data-tooltip={`${label}: ${description}`} disabled={watcherBusy} onClick={() => onWatcherChange(key, !watchers[key])}><Icon /><span>{label}</span></button>)}</nav>}</header>
    <div className={styles.timelineBody}>
      <header className={styles.timelineHeader}>
        <small>{events ? <>Private observed timeline · newest to oldest · {visible.length} events{retentionDays ? ` · ${retentionDays} days` : ""}</> : <>Private · {visible.length} of {entries.length} first observed</>}</small>
        {!events && <label>History<select aria-label="Recent loot cards to keep" value={displayLimit} onChange={(event) => { setPage(0); onDisplayLimitChange?.(Number(event.target.value) as RecentLootDisplayLimit); }}>{DISPLAY_LIMITS.map((limit) => <option key={limit} value={limit}>{limit}</option>)}</select></label>}
        <button type="button" onClick={onHide}>Hide</button>
      </header>
      <div className={styles.carousel}><button type="button" aria-label="Previous recent loot page" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={currentPage === 0}><ChevronLeft /></button><div className={styles.carouselViewport} ref={viewport}><div className={styles.carouselPage}>{pageEntries.length ? pageEntries.map(renderEntry) : <p role={error ? "alert" : undefined}>{emptyMessage}{error && onRetry && <button type="button" onClick={onRetry}>Retry</button>}</p>}</div></div><span className={styles.pageCount}>{currentPage + 1} / {pageCount}</span><button type="button" aria-label="Next recent loot page" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={currentPage >= pageCount - 1}><ChevronRight /></button></div>
      {(observedAt || warnings.length > 0 || watcherStatus) && <footer className={styles.timelineFooter}>{observedAt && <small>Checked {new Date(observedAt).toLocaleTimeString()}</small>}{watcherStatus && <small className={styles.watcherStatus}>{watcherStatus}</small>}{warnings.map((warning) => <small className={styles.timelineWarning} key={warning}>{warning}</small>)}</footer>}
    </div>
  </section>;
}

function TimelineEventCard({ event, active, onTag, onSocketChange, busy, pullShortcut = false }: { event: RecentItemEvent; active: React.RefObject<LootItem | undefined>; onTag: (item: LootItem, tag?: GearTag) => void; onSocketChange?: WeaponSocketChange; busy: boolean; pullShortcut?: boolean }) {
  if (event.gear) return <RecentItemCard compact item={event.gear} onActivate={() => { active.current = event.gear; }} onDeactivate={() => { if (active.current?.instanceId === event.gear?.instanceId) active.current = undefined; }} onTag={(tag) => onTag(event.gear!, tag)} onSocketChange={onSocketChange} busy={busy} pullShortcut={pullShortcut} />;
  return <RecentTimelineCard event={event} />;
}

export function RecentTimelineCard({ event }: { event: RecentItemEvent }) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const completed = event.kind === "catalyst-completed";
  const inventory = event.kind === "inventory-gained" || event.kind === "exotic-engram-found";
  const engram = event.kind === "exotic-engram-found";
  const rarity = event.rarity || (inventory ? "Unknown" : "Exotic");
  const label = completed ? "100%" : inventory ? `×${event.quantity}` : event.kind === "catalyst-found" ? "Found" : `×${event.quantity}`;
  const type = event.kind === "catalyst-completed" ? "Catalyst completed" : event.kind === "catalyst-found" ? "Catalyst found" : engram ? "Exotic Engram found" : event.itemType || "Inventory item found";
  const observationLabel = event.lastObservedAt !== event.observedAt ? `${new Date(event.observedAt).toLocaleString()}–${new Date(event.lastObservedAt).toLocaleString()}` : new Date(event.observedAt).toLocaleString();
  return <article className={`${styles.card} ${styles.compactCard} ${styles.timelineCard} ${inventory ? styles.inventoryCard : styles.catalystCard}`} data-rarity={rarity} tabIndex={0} onKeyDown={(key) => { if (key.key === "Escape") setOpen(false); }} onFocus={() => setOpen(true)} onBlur={(focus) => { if (!focus.currentTarget.contains(focus.relatedTarget)) setOpen(false); }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button className={styles.tile} type="button" aria-label={`Inspect ${event.name}`} aria-expanded={open} aria-describedby={open ? tooltipId : undefined} onClick={() => setOpen(true)}><span className={styles.art}>{event.icon ? <img src={event.icon} alt="" /> : <Sparkles />}</span><span className={styles.metrics}><b className={completed ? styles.catalystDone : undefined}>{completed && <Check aria-label="100%" />}{label}</b><strong className={styles.catalystMark}>{inventory ? "Gained" : "Catalyst"}</strong></span></button>
    <span className={styles.cardName}>{event.name}</span>
    <div className={styles.cardActions} />
    {open && <aside id={tooltipId} className={styles.tooltip} role="tooltip"><header>{event.icon && <img src={event.icon} alt="" />}<span><small>{type}</small><strong>{event.name}</strong><em>{event.rarity || (inventory ? "Inventory" : "Exotic")}</em></span></header><div className={styles.identity}><b>{label}</b><span>{type}</span></div>{event.description && <p>{event.description}</p>}<nav className={styles.sourceLinks}>{event.itemHash ? <a href={`https://www.light.gg/db/items/${event.itemHash}`} target="_blank" rel="noreferrer">light.gg <ExternalLink /></a> : <Link to="/collection?view=catalysts">Open catalyst details</Link>}<span><Clock3 /> Observed {observationLabel}</span></nav><footer>Guardian Nexus detected this change between Bungie profile snapshots; the exact in-game pickup time may be earlier.</footer></aside>}
  </article>;
}

export function RecentCatalystCard({ catalyst }: { catalyst: RecentCatalystObservation }) {
  const [open, setOpen] = useState(false);
  const status = catalyst.state === "complete" ? "100%" : `${Math.round(catalyst.percent)}%`;
  return <article className={`${styles.card} ${styles.compactCard} ${styles.catalystCard}`} data-rarity="Exotic" tabIndex={0} onFocus={() => setOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <Link className={styles.tile} to="/collection?view=catalysts" aria-label={`Inspect ${catalyst.name}`} onClick={() => setOpen(true)}>
      <span className={styles.art}>{catalyst.icon ? <img src={catalyst.icon} alt="" /> : <Sparkles />}</span>
      <span className={styles.metrics}><b className={catalyst.state === "complete" ? styles.catalystDone : undefined}>{catalyst.state === "complete" && <Check aria-label="100%" />}{status}</b><strong className={styles.catalystMark}>Catalyst</strong></span>
    </Link>
    <span className={styles.cardName}>{catalyst.name}</span>
    <div className={styles.cardActions}><Link to="/collection?view=catalysts">Open</Link></div>
    {open && <aside className={styles.tooltip} role="tooltip"><header>{catalyst.icon && <img src={catalyst.icon} alt="" />}<span><small>Exotic catalyst</small><strong>{catalyst.name}</strong><em>{catalyst.state === "complete" ? "Masterworked" : "Masterwork in progress"}</em></span></header><div className={styles.identity}><b>{status}</b><span>{catalyst.state === "complete" ? "Masterworked" : "Obtained"}</span></div><nav className={styles.sourceLinks}><Link to="/collection?view=catalysts">Open catalyst details</Link><span><Clock3 /> First observed {new Date(catalyst.observedAt).toLocaleString()}</span></nav><footer>Catalyst state is private to this browser and signed-in Guardian.</footer></aside>}
  </article>;
}

export function TimelineEventTooltip({ event, id }: { event: RecentItemEvent; id?: string }) {
  const completed = event.kind === "catalyst-completed";
  const inventory = event.kind === "inventory-gained" || event.kind === "exotic-engram-found";
  const engram = event.kind === "exotic-engram-found";
  const label = completed ? "100%" : inventory ? `×${event.quantity}` : event.kind === "catalyst-found" ? "Found" : `×${event.quantity}`;
  const type = completed ? "Catalyst completed" : event.kind === "catalyst-found" ? "Catalyst found" : engram ? "Exotic Engram found" : event.itemType || "Inventory item found";
  const observationLabel = event.lastObservedAt !== event.observedAt ? `${new Date(event.observedAt).toLocaleString()}–${new Date(event.lastObservedAt).toLocaleString()}` : new Date(event.observedAt).toLocaleString();
  return <aside id={id} className={styles.tooltip} role="tooltip"><header>{event.icon && <img src={event.icon} alt="" />}<span><small>{type}</small><strong>{event.name}</strong><em>{event.rarity || (inventory ? "Inventory" : "Exotic")}</em></span></header><div className={styles.identity}><b>{label}</b><span>{type}</span></div>{event.description && <p>{event.description}</p>}<nav className={styles.sourceLinks}>{event.itemHash ? <a href={`https://www.light.gg/db/items/${event.itemHash}`} target="_blank" rel="noreferrer">light.gg <ExternalLink /></a> : <Link to="/collection?view=catalysts">Open catalyst details</Link>}<span><Clock3 /> Observed {observationLabel}</span></nav><footer>Guardian Nexus detected this change between Bungie profile snapshots; the exact in-game pickup time may be earlier.</footer></aside>;
}

export function RecentItemCard({ item, onActivate, onDeactivate, onTag, onSocketChange, busy, compact = false, pullShortcut = false, actions }: { item: LootItem; onActivate: () => void; onDeactivate: () => void; onTag: (tag?: GearTag) => void; onSocketChange?: WeaponSocketChange; busy: boolean; compact?: boolean; pullShortcut?: boolean; actions?: ReactNode }) {
  const [selected, setSelected] = useState(false);
  const card = useRef<HTMLElement>(null);
  const tooltipId = useId();
  const ratingContext = useResolvedWeaponRatings();
  useEffect(() => {
    if (!selected) return;
    const closeOutside = (event: PointerEvent) => {
      if (!card.current?.contains(event.target as Node)) { setSelected(false); onDeactivate(); }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [selected, onDeactivate]);
  const close = () => { setSelected(false); onDeactivate(); };
  const value = item.kind === "weapon" ? evaluateWeapon(item, ratingContext.database) : undefined;
  return <article ref={card} className={`${styles.card} ${compact ? styles.compactCard : ""}`} data-rarity={item.rarity} data-actions={Boolean(actions)} data-selected={selected} onKeyDown={(key) => { if (key.key === "Escape") close(); }} onFocus={onActivate} onBlur={(event) => { if (!selected && !event.currentTarget.contains(event.relatedTarget)) onDeactivate(); }} onMouseEnter={onActivate} onMouseLeave={() => { if (!selected) onDeactivate(); }}>
    <button className={styles.tile} type="button" aria-label={`Inspect ${item.name}`} aria-expanded={selected} aria-controls={selected ? tooltipId : undefined} onClick={() => { if (selected) close(); else { setSelected(true); onActivate(); } }}>
      <span className={styles.art}><GearTierRail tier={item.gearTier} kind={item.kind === "weapon" ? "Weapon" : "Armor"} />{item.icon ? <img src={item.icon} alt="" /> : <Sparkles />}</span>
      <span className={styles.metrics}><b>{item.power || "—"}</b>{item.kind === "weapon" && <strong className={styles.score} data-state={value?.state} data-quality={value?.quality}>{value?.state === "scored" ? <><span>{item.rollDataState === "complete" ? "Roll" : "Est."} {value.overall ?? "—"}%</span><small>{qualityLabel(value.quality)}</small></> : value?.state === "incomplete" ? "Roll pending" : "No rating"}</strong>}</span>
    </button>
    <span className={styles.cardName}>{item.name}</span>
    <div className={styles.cardActions}>{!selected && <><ItemLocationBadge item={item} /><GearTagPicker value={item.tag} onChange={onTag} compact disabled={busy} /></>}{actions}</div>
    {selected && <ItemTooltip id={tooltipId} item={item} utility onClose={close} onTag={onTag} onSocketChange={onSocketChange} busy={busy} pullShortcut={pullShortcut} />}
  </article>;
}

export function ItemTooltip({ item, id, utility = false, onClose, onTag, onSocketChange, busy = false, pullShortcut = false }: { item: LootItem; id?: string; utility?: boolean; onClose?: () => void; onTag?: (tag?: GearTag) => void; onSocketChange?: WeaponSocketChange; busy?: boolean; pullShortcut?: boolean }) {
  return <aside id={id} className={`${styles.tooltip} ${utility ? styles.utilityCard : ""}`} role={utility ? "dialog" : "tooltip"} aria-label={utility ? `${item.name} details` : undefined}><header>{item.icon && <img src={item.icon} alt="" />}<span><small>{item.rarity} {item.kind}</small><strong>{item.name}</strong><em>{item.kind === "weapon" ? `${item.damageType} · ${item.itemType}` : item.slot}</em></span>{utility && <button className={styles.utilityClose} type="button" aria-label={`Close ${item.name} details`} onClick={onClose}><X /></button>}</header>
    <div className={styles.identity}><b>{item.power || "—"} Power</b><span>{item.kind === "weapon" ? item.slot : item.className}</span>{item.kind === "armor" && item.archetype && <ArmorArchetypeBadge archetype={item.archetype} />}<span>{item.inPostmaster ? "Postmaster" : item.location}{item.equipped ? " · Equipped" : ""}</span></div>
    <nav className={styles.sourceLinks}><a href={`https://www.light.gg/db/items/${item.itemHash}`} target="_blank" rel="noreferrer">light.gg <ExternalLink /></a><span><Clock3 /> First observed {new Date(item.firstSeenAt).toLocaleString()}</span></nav>
    {item.kind === "weapon" ? <>
      {item.trackerValue !== undefined && <p className={styles.tracker}><BarChart3 /> Enemies defeated <b>{item.trackerValue.toLocaleString()}</b></p>}
      <div className={styles.weaponStats}>{(item.stats || []).map((stat) => <span key={stat.hash}><small>{stat.name}</small>{stat.displayAsNumeric ? <i /> : <i><em style={{ width: `${Math.min(100, Math.max(0, stat.value / Math.max(1, stat.maximumValue) * 100))}%` }} /></i>}<b>{stat.value}</b></span>)}</div>
      {item.masterwork && <div className={styles.intrinsic}>{item.masterwork.icon && <img src={item.masterwork.icon} alt="" />}<span><b>{item.masterwork.name}</b><small>{item.masterwork.description || "Weapon masterwork"}</small></span></div>}
      <WeaponRatingPanel weapon={item} compact busy={busy} onSelectPlug={onSocketChange ? (socketIndex, plugItemHash) => onSocketChange(item, socketIndex, plugItemHash) : undefined} />
    </> : <div className={styles.stats}>{Object.entries(item.baseStats).map(([name, score]) => <span key={name}><small>{name}</small><b>{score}</b></span>)}<strong>Base {item.baseTotal} · Current {item.currentTotal}</strong></div>}
    {utility && onTag && <div className={styles.cardActions}><GearTagPicker value={item.tag} onChange={onTag} compact disabled={busy} /></div>}
    <footer>First observed time is Guardian Nexus history, not an exact Bungie drop timestamp. Shortcuts: Shift+1 Favorite · 2 Keep · 3 Junk · 4 Archive · 5 Infuse{pullShortcut ? " · P Pull to selected character" : ""}</footer>
  </aside>;
}

function ArmorArchetypeBadge({ archetype }: { archetype: ArmorPerk }) {
  const trigger = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{ top: number; left: number }>();
  const show = () => {
    const bounds = trigger.current?.getBoundingClientRect();
    if (!bounds) return;
    setPosition({ top: bounds.top - 7, left: Math.max(118, Math.min(window.innerWidth - 118, bounds.left + bounds.width / 2)) });
  };
  return <>
    <span ref={trigger} className={styles.archetypeBadge} tabIndex={0} aria-label={`Armor archetype: ${archetype.name}`} aria-describedby={position ? tooltipId : undefined} onMouseEnter={show} onMouseLeave={() => setPosition(undefined)} onFocus={show} onBlur={() => setPosition(undefined)}>{archetype.icon ? <img src={archetype.icon} alt="" /> : <Sparkles />}</span>
    {position && createPortal(<span id={tooltipId} className={styles.archetypeTooltip} role="tooltip" style={{ top: position.top, left: position.left }}><b>{archetype.name}</b>{archetype.description && <small>{archetype.description}</small>}</span>, document.body)}
  </>;
}

function ItemLocationBadge({ item }: { item: LootItem }) {
  const state = itemLocationLabel(item);
  const Icon = item.inPostmaster ? Inbox : item.equipped || item.location === "equipped" ? Shield : item.location === "vault" ? Archive : UserRound;
  return <span className={styles.locationBadge} title={state} role="img" tabIndex={0} aria-label={state} data-tooltip={state}><Icon aria-hidden="true" /></span>;
}

function itemLocationLabel(item: LootItem): string { return item.inPostmaster ? "Postmaster" : item.equipped || item.location === "equipped" ? "Equipped" : item.location === "vault" ? "Vault" : "On a character"; }

function isTyping(target: EventTarget | null): boolean { return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']")); }
function byNewest(left: LootItem, right: LootItem): number { return Date.parse(right.firstSeenAt) - Date.parse(left.firstSeenAt); }
function useLootShortcuts(active: React.RefObject<LootItem | undefined>, onTag: (item: LootItem, tag?: GearTag) => void, onPull?: LootPull, busy = false): void {
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const item = active.current;
      if (!item || isTyping(event.target)) return;
      if (event.key.toLocaleLowerCase() === "p" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && onPull && !busy) {
        event.preventDefault(); onPull(item); return;
      }
      const tag = event.shiftKey ? SHORTCUT_TAGS[event.key] : undefined;
      if (!tag) return;
      event.preventDefault(); onTag(item, tag);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [active, busy, onPull, onTag]);
}
