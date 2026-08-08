import type { ArmorItem, GearTag, WeaponItem } from "@guardian-nexus/contracts";
import { BarChart3, Check, ChevronLeft, ChevronRight, Clock3, Columns3, ExternalLink, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { evaluateWeapon, loadWeaponRatings, qualityLabel } from "../../modules/loot/weaponEvaluator";
import { GearTagBadge, GearTagPicker } from "./GearTagPicker";
import styles from "./RecentLoot.module.css";

export type LootItem = ({ kind: "armor" } & ArmorItem) | ({ kind: "weapon" } & WeaponItem);
export type RecentLootDisplayLimit = 12 | 24 | 48;
export interface RecentCatalystObservation { recordHash: string; name: string; icon: string; state: "obtained" | "complete"; percent: number; observedAt: string }
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

export function RecentItemRow({ title, items, onTag, busy = false, empty = "No newly observed items." }: { title: string; items: LootItem[]; onTag: (item: LootItem, tag?: GearTag) => void; busy?: boolean; empty?: string }) {
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
  return <section className={styles.row}><header><Sparkles /><span><strong>{title}</strong><small>{items.length} new · first observed by Guardian Nexus</small></span></header>{items.length ? <div>{items.map((item) => <RecentItemCard key={item.instanceId} item={item} onActivate={() => { active.current = item; }} onDeactivate={() => { if (active.current?.instanceId === item.instanceId) active.current = undefined; }} onTag={(tag) => onTag(item, tag)} busy={busy} />)}</div> : <p>{empty}</p>}</section>;
}

export function LootHistoryGrid({ title, subtitle, items, onTag, busy = false, empty, itemActions }: { title: string; subtitle: string; items: LootItem[]; onTag: (item: LootItem, tag?: GearTag) => void; busy?: boolean; empty: string; itemActions?: (item: LootItem) => ReactNode }) {
  const active = useRef<LootItem | undefined>(undefined);
  useLootShortcuts(active, onTag);
  return <section className={styles.history}><header><span><strong>{title}</strong><small>{subtitle}</small></span><b>{items.length}</b></header>{items.length ? <div>{items.map((item) => <RecentItemCard key={item.instanceId} item={item} onActivate={() => { active.current = item; }} onDeactivate={() => { if (active.current?.instanceId === item.instanceId) active.current = undefined; }} onTag={(tag) => onTag(item, tag)} busy={busy} actions={itemActions?.(item)} />)}</div> : <p>{empty}</p>}</section>;
}

export function parseRecentLootDisplayLimit(value?: string): RecentLootDisplayLimit {
  if (value === "12" || value === "48") return Number(value) as 12 | 48;
  return 24;
}

export function recentLootPageSize(width: number): number {
  return Math.max(1, Math.floor(Math.max(0, width) / 89));
}

export function CompactRecentLootBar({ items, catalysts = [], displayLimit = 24, onDisplayLimitChange, onTag, busy = false, onHide }: { items: LootItem[]; catalysts?: RecentCatalystObservation[]; displayLimit?: RecentLootDisplayLimit; onDisplayLimitChange?: (limit: RecentLootDisplayLimit) => void; onTag: (item: LootItem, tag?: GearTag) => void; busy?: boolean; onHide: () => void }) {
  const active = useRef<LootItem | undefined>(undefined);
  const viewport = useRef<HTMLDivElement | null>(null);
  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(0);
  useLootShortcuts(active, onTag);
  const gearEntries = items.map((item) => ({ kind: "gear" as const, observedAt: item.firstSeenAt, item }));
  const catalystEntries = catalysts.map((catalyst) => ({ kind: "catalyst" as const, observedAt: catalyst.observedAt, catalyst }));
  const entries = [...gearEntries, ...catalystEntries];
  const reservedCatalysts = gearEntries.length && catalystEntries.length ? Math.min(catalystEntries.length, Math.max(1, Math.floor(displayLimit / 4))) : catalystEntries.length;
  const selectedGear = gearEntries.slice(0, displayLimit - reservedCatalysts);
  const visible = [...selectedGear, ...catalystEntries.slice(0, displayLimit - selectedGear.length)].sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt));
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
  return <section className={styles.compactBar}><header><Sparkles /><span><strong>Recent loot</strong><small>Private · {visible.length} of {entries.length} first observed</small></span><label>History<select aria-label="Recent loot cards to keep" value={displayLimit} onChange={(event) => { setPage(0); onDisplayLimitChange?.(Number(event.target.value) as RecentLootDisplayLimit); }}>{DISPLAY_LIMITS.map((limit) => <option key={limit} value={limit}>{limit}</option>)}</select></label></header><div className={styles.carousel}><button type="button" aria-label="Previous recent loot page" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={currentPage === 0}><ChevronLeft /></button><div className={styles.carouselViewport} ref={viewport}><div className={styles.carouselPage}>{pageEntries.length ? pageEntries.map((entry) => entry.kind === "gear" ? <RecentItemCard compact key={`gear-${entry.item.instanceId}`} item={entry.item} onActivate={() => { active.current = entry.item; }} onDeactivate={() => { if (active.current?.instanceId === entry.item.instanceId) active.current = undefined; }} onTag={(tag) => onTag(entry.item, tag)} busy={busy} /> : <RecentCatalystCard key={`catalyst-${entry.catalyst.recordHash}`} catalyst={entry.catalyst} />) : <p>No newly observed gear or catalysts.</p>}</div></div><span className={styles.pageCount}>{currentPage + 1} / {pageCount}</span><button type="button" aria-label="Next recent loot page" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={currentPage >= pageCount - 1}><ChevronRight /></button></div><button type="button" onClick={onHide}>Hide</button></section>;
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

export function RecentItemCard({ item, onActivate, onDeactivate, onTag, busy, compact = false, actions }: { item: LootItem; onActivate: () => void; onDeactivate: () => void; onTag: (tag?: GearTag) => void; busy: boolean; compact?: boolean; actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [, setRatingsLoaded] = useState(false);
  useEffect(() => {
    if (item.kind === "weapon") void loadWeaponRatings().then((database) => setRatingsLoaded(Boolean(database)));
  }, [item.kind]);
  const value = item.kind === "weapon" ? evaluateWeapon(item) : undefined;
  return <article className={`${styles.card} ${compact ? styles.compactCard : ""}`} data-rarity={item.rarity} data-actions={Boolean(actions)} tabIndex={0} onFocus={() => { onActivate(); setOpen(true); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { onDeactivate(); setOpen(false); } }} onMouseEnter={() => { onActivate(); setOpen(true); }} onMouseLeave={() => { onDeactivate(); setOpen(false); }}>
    <button className={styles.tile} type="button" aria-label={`Inspect ${item.name}`} onClick={() => setOpen(true)}>
      <span className={styles.art}>{item.icon ? <img src={item.icon} alt="" /> : <Sparkles />}<GearTagBadge tag={item.tag} /></span>
      <span className={styles.metrics}><b>{item.power || "—"}</b>{item.kind === "weapon" && <strong className={styles.score} data-state={value?.state} data-quality={value?.quality}>{value?.state === "scored" ? <><span>{value.overall ?? "—"}%</span><small>{qualityLabel(value.quality)}</small></> : "Unrated"}</strong>}</span>
    </button>
    <span className={styles.cardName}>{item.name}</span>
    <div className={styles.cardActions}><GearTagPicker value={item.tag} onChange={onTag} compact disabled={busy} />{actions}</div>
    {open && <ItemTooltip item={item} />}
  </article>;
}

function ItemTooltip({ item }: { item: LootItem }) {
  const value = item.kind === "weapon" ? evaluateWeapon(item) : undefined;
  return <aside className={styles.tooltip} role="tooltip"><header>{item.icon && <img src={item.icon} alt="" />}<span><small>{item.rarity} {item.kind}</small><strong>{item.name}</strong><em>{item.kind === "weapon" ? `${item.damageType} · ${item.itemType}` : item.slot}</em></span></header>
    <div className={styles.identity}><b>{item.power || "—"} Power</b><span>{item.kind === "weapon" ? item.slot : item.className}</span><span>{item.location}{item.equipped ? " · Equipped" : ""}</span></div>
    <nav className={styles.sourceLinks}><a href={`https://www.light.gg/db/items/${item.itemHash}`} target="_blank" rel="noreferrer">light.gg <ExternalLink /></a><span><Clock3 /> First observed {new Date(item.firstSeenAt).toLocaleString()}</span></nav>
    {item.kind === "weapon" ? <>
      {item.trackerValue !== undefined && <p className={styles.tracker}><BarChart3 /> Enemies defeated <b>{item.trackerValue.toLocaleString()}</b></p>}
      <div className={styles.weaponStats}>{(item.stats || []).map((stat) => <span key={stat.hash}><small>{stat.name}</small>{stat.displayAsNumeric ? <i /> : <i><em style={{ width: `${Math.min(100, Math.max(0, stat.value / Math.max(1, stat.maximumValue) * 100))}%` }} /></i>}<b>{stat.value}</b></span>)}</div>
      {item.masterwork && <div className={styles.intrinsic}>{item.masterwork.icon && <img src={item.masterwork.icon} alt="" />}<span><b>{item.masterwork.name}</b><small>{item.masterwork.description || "Weapon masterwork"}</small></span></div>}
      <div className={styles.perks}>{item.perkColumns.map((column) => <span key={column.socketIndex}>{column.active?.icon ? <img src={column.active.icon} alt="" /> : <Columns3 />}<b>{column.active?.name || "Unknown socket"}</b><small>{column.active?.description || `${column.options.length} selectable options`}</small></span>)}</div>
      <div className={styles.value} data-state={value?.state} data-quality={value?.quality}>{value?.state === "scored" ? <>
        <header><span><b>{qualityLabel(value.quality)} roll</b><small>{value.basis === "weapon" ? "Exact weapon evidence" : `${item.itemType} fallback`}</small></span><strong>{value.overall}%</strong></header>
        <div className={styles.modeScores}><span><small>PvE</small><b>{value.pve === undefined ? "—" : `${value.pve}%`}</b></span><span><small>PvP</small><b>{value.pvp === undefined ? "—" : `${value.pvp}%`}</b></span><span><small>Confidence</small><b>{value.confidence}</b></span></div>
        {value.reasons.map((reason) => <p key={reason}>{reason}</p>)}
        <small>Source: {value.source}. Reviewed {value.reviewedAt}.</small>
      </> : <><b>Community rating unavailable</b><small>{value?.reasons[0]}</small></>}</div>
    </> : <div className={styles.stats}>{Object.entries(item.baseStats).map(([name, score]) => <span key={name}><small>{name}</small><b>{score}</b></span>)}<strong>Base {item.baseTotal} · Current {item.currentTotal}</strong></div>}
    <footer>First observed time is Guardian Nexus history, not an exact Bungie drop timestamp. Shortcuts: Shift+1 Favorite · 2 Keep · 3 Junk · 4 Archive · 5 Infuse</footer>
  </aside>;
}

function isTyping(target: EventTarget | null): boolean { return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']")); }
function byNewest(left: LootItem, right: LootItem): number { return Date.parse(right.firstSeenAt) - Date.parse(left.firstSeenAt); }
function useLootShortcuts(active: React.RefObject<LootItem | undefined>, onTag: (item: LootItem, tag?: GearTag) => void): void {
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { const tag = event.shiftKey ? SHORTCUT_TAGS[event.key] : undefined; if (!tag || !active.current || isTyping(event.target)) return; event.preventDefault(); onTag(active.current, tag); };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [active, onTag]);
}
