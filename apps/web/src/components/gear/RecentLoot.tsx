import type { ArmorItem, GearTag, WeaponItem } from "@guardian-nexus/contracts";
import { Clock3, Columns3, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { evaluateWeapon } from "../../modules/loot/weaponEvaluator";
import { GearTagBadge, GearTagPicker } from "./GearTagPicker";
import styles from "./RecentLoot.module.css";

export type LootItem = ({ kind: "armor" } & ArmorItem) | ({ kind: "weapon" } & WeaponItem);
const SHORTCUT_TAGS: Record<string, GearTag> = { "1": "favorite", "2": "keep", "3": "junk", "4": "archive", "5": "infuse" };

export function recentLoot(armor: ArmorItem[], weapons: WeaponItem[], kind: "all" | "armor" | "weapon" = "all", limit = 30): LootItem[] {
  return [
    ...(kind !== "weapon" ? armor.map((item) => ({ ...item, kind: "armor" as const })) : []),
    ...(kind !== "armor" ? weapons.map((item) => ({ ...item, kind: "weapon" as const })) : [])
  ].filter((item) => item.isNew).sort((left, right) => Date.parse(right.firstSeenAt) - Date.parse(left.firstSeenAt)).slice(0, limit);
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

export function RecentItemCard({ item, onActivate, onDeactivate, onTag, busy }: { item: LootItem; onActivate: () => void; onDeactivate: () => void; onTag: (tag?: GearTag) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const value = item.kind === "weapon" ? evaluateWeapon(item) : undefined;
  return <article className={styles.card} data-rarity={item.rarity} tabIndex={0} onFocus={() => { onActivate(); setOpen(true); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { onDeactivate(); setOpen(false); } }} onMouseEnter={() => { onActivate(); setOpen(true); }} onMouseLeave={() => { onDeactivate(); setOpen(false); }}>
    <div className={styles.art}>{item.icon ? <img src={item.icon} alt="" /> : <Sparkles />}<GearTagBadge tag={item.tag} /></div><span><b>{item.name}</b><small>{item.kind === "weapon" ? `${item.damageType} · ${item.itemType}` : `${item.rarity} · ${item.slot}`}</small><em><Clock3 />{formatObserved(item.firstSeenAt)}</em></span>
    {item.kind === "weapon" && <strong className={styles.score} data-state={value?.state}>{value?.state === "scored" ? `${value.overall ?? "—"}` : "?"}<small>{value?.state === "scored" ? "value" : "unrated"}</small></strong>}
    <GearTagPicker value={item.tag} onChange={onTag} compact disabled={busy} />
    {open && <ItemTooltip item={item} />}
  </article>;
}

function ItemTooltip({ item }: { item: LootItem }) {
  const value = item.kind === "weapon" ? evaluateWeapon(item) : undefined;
  return <aside className={styles.tooltip} role="tooltip"><header>{item.icon && <img src={item.icon} alt="" />}<span><small>{item.rarity} {item.kind}</small><strong>{item.name}</strong><em>{item.power || "—"} Power · {item.location}{item.equipped ? " · Equipped" : ""}</em></span></header>
    <p><Clock3 /> First observed {new Date(item.firstSeenAt).toLocaleString()}. Exact acquisition time and drop source were not returned by Bungie.</p>
    {item.kind === "weapon" ? <><div className={styles.perks}>{item.perkColumns.map((column) => <span key={column.socketIndex}>{column.active?.icon ? <img src={column.active.icon} alt="" /> : <Columns3 />}<b>{column.active?.name || "Unknown socket"}</b><small>{column.active?.description || `${column.options.length} selectable options`}</small></span>)}</div><div className={styles.value}><b>{value?.state === "scored" ? `Overall ${value.overall ?? "—"} · PvE ${value.pve ?? "—"} · PvP ${value.pvp ?? "—"}` : "Community value unavailable"}</b><small>{value?.reasons[0]}</small></div></> : <div className={styles.stats}>{Object.entries(item.baseStats).map(([name, score]) => <span key={name}><small>{name}</small><b>{score}</b></span>)}<strong>Base {item.baseTotal} · Current {item.currentTotal} · Grade {item.grade.letter}</strong></div>}
    <footer>Shortcuts: Shift+1 Favorite · 2 Keep · 3 Junk · 4 Archive · 5 Infuse</footer>
  </aside>;
}

function formatObserved(value: string): string { const time = Date.parse(value); if (!Number.isFinite(time)) return "Time unknown"; const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000)); return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes}m ago` : new Date(time).toLocaleDateString(); }
function isTyping(target: EventTarget | null): boolean { return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable='true']")); }
