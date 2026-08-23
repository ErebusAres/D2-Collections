import type { ArmorPerk, WeaponItem, WeaponPerkColumn } from "@guardian-nexus/contracts";
import { Columns3, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { evaluateWeapon, evaluateWeaponPerk, qualityLabel, WEAPON_RATING_SOURCES, type WeaponRatingDatabase, type WeaponTraitValue, type WeaponRatingSourceId } from "../../modules/loot/weaponEvaluator";
import { useResolvedWeaponRatings } from "../../modules/loot/useResolvedWeaponRatings";
import styles from "./WeaponRatingPanel.module.css";

export function WeaponRatingPanel({ weapon, ratings, compact = false, showTraits = true, onSelectPlug, busy = false }: { weapon: WeaponItem; ratings?: WeaponRatingDatabase; compact?: boolean; showTraits?: boolean; onSelectPlug?: (socketIndex: number, plugItemHash: string) => void; busy?: boolean }) {
  const ratingContext = useResolvedWeaponRatings();
  const selectedSource = WEAPON_RATING_SOURCES.find((source) => source.id === ratingContext.sourceId) || WEAPON_RATING_SOURCES[0]!;
  const database = ratings || ratingContext.database;
  const value = evaluateWeapon(weapon, database);
  const columns = ratedColumns(weapon);
  return <section className={`${styles.panel} ${compact ? styles.compact : ""}`} data-state={value.state} data-quality={value.quality}>
    <header className={styles.summary}><span><small>Community roll</small><strong>{value.state === "scored" ? `${weapon.rollDataState === "complete" ? "" : "Est. "}${qualityLabel(value.quality)}` : value.state === "incomplete" ? "Pending" : "Unrated"}</strong></span><div className={styles.modeScores}><ModeScore mode="PvE" score={value.pve} /><ModeScore mode="PvP" score={value.pvp} /></div></header>
    {!ratings && <label className={styles.ratingSource}><span>Rating source</span><select aria-label="Weapon rating source" value={ratingContext.sourceId} onChange={(event) => ratingContext.setSource(event.target.value as WeaponRatingSourceId)} disabled={ratingContext.loading}>{ratingSources().map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select><small><b>Used by:</b> {selectedSource.usedBy}. {selectedSource.note}</small></label>}
    {value.state === "scored" && <p className={styles.evidence}>{basisLabel(value.basis, weapon.itemType, database?.source.name || selectedSource.label)} · {value.confidence} confidence · {value.comparedColumns}/{value.totalColumns} columns</p>}
    {showTraits && (columns.length ? <div className={styles.columns}>{columns.map((column) => <TraitColumn key={`${column.socketIndex}:${column.ratingColumn ?? column.kind}`} weapon={weapon} column={column} ratings={database} onSelectPlug={onSelectPlug} busy={busy} />)}</div> : <p className={styles.pending}>Trait and attachment pool unavailable.</p>)}
    {showTraits && columns.length > 0 && <footer className={styles.legend}><span><ThumbsUp /> Recommended</span><span><ThumbsDown /> Not recommended</span><span>Blue = equipped</span></footer>}
  </section>;
}

function ratingSources() {
  return [
    { id: "voltron", label: "Voltron — DIM + Destiny Recipes" },
    { id: "choosy-voltron", label: "Choosy Voltron — DIM" },
    { id: "just-another-team", label: "Just Another Team — DIM" }
  ] as const;
}

function ModeScore({ mode, score }: { mode: "PvE" | "PvP"; score?: number }) {
  return <span data-known={score !== undefined}><small>{mode}</small><b>{score === undefined ? "—" : `${score}%`}</b></span>;
}

function TraitColumn({ weapon, column, ratings, onSelectPlug, busy }: { weapon: WeaponItem; column: WeaponPerkColumn; ratings?: WeaponRatingDatabase; onSelectPlug?: (socketIndex: number, plugItemHash: string) => void; busy: boolean }) {
  const options = uniqueTraitOptions(column);
  return <section className={styles.column}><header><b>{columnLabel(weapon, column)}</b><small>{options.length}</small></header><div className={styles.perkGrid}>{options.map((perk) => {
    const rating = column.ratingColumn === undefined ? originRating(ratings?.source.name) : evaluateWeaponPerk(weapon, column.ratingColumn, perk.hash, ratings);
    const active = perk.hash === column.active?.hash;
    const selectable = !active && column.socketIndex >= 0 && Boolean(column.selectablePlugHashes?.includes(perk.hash));
    return <PerkOption key={perk.hash} perk={perk} rating={rating} active={active} selectable={selectable && Boolean(onSelectPlug)} busy={busy} onSelect={() => onSelectPlug?.(column.socketIndex, perk.hash)} />;
  })}</div></section>;
}

function PerkOption({ perk, rating, active, selectable, busy, onSelect }: { perk: ArmorPerk; rating: WeaponTraitValue; active: boolean; selectable: boolean; busy: boolean; onSelect: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [position, setPosition] = useState<{ top: number; left: number; side: "left" | "right" }>();
  const showDetail = () => {
    const bounds = button.current?.getBoundingClientRect();
    if (!bounds) return;
    const useLeft = bounds.right + 240 > window.innerWidth;
    setPosition({
      top: Math.max(78, Math.min(window.innerHeight - 78, bounds.top + bounds.height / 2)),
      left: useLeft ? bounds.left - 10 : bounds.right + 10,
      side: useLeft ? "left" : "right"
    });
  };
  return <>
    <button ref={button} className={styles.perk} type="button" data-active={active} data-selectable={selectable} disabled={busy} aria-label={`${traitTitle(perk, rating, active)}${selectable ? ". Select this option" : ""}`} aria-describedby={position ? tooltipId : undefined} onClick={selectable ? onSelect : undefined} onMouseEnter={showDetail} onMouseLeave={() => setPosition(undefined)} onFocus={showDetail} onBlur={() => setPosition(undefined)}>
      <span className={styles.perkIcon}>{perk.icon ? <img src={perk.icon} alt="" /> : <Columns3 />}
        <span className={styles.modeMarks}><TraitMode mode="E" score={rating.pve} exact={rating.basis === "weapon"} /><TraitMode mode="P" score={rating.pvp} exact={rating.basis === "weapon"} /></span>
      </span>
    </button>
    {position && createPortal(<div id={tooltipId} role="tooltip" className={styles.perkDetail} data-side={position.side} style={{ top: position.top, left: position.left }}><strong>{perk.name}</strong>{perk.description && <p>{perk.description}</p>}<span><b>PvE</b>{traitModeLabel(rating.pve, rating.basis === "weapon")}</span><span><b>PvP</b>{traitModeLabel(rating.pvp, rating.basis === "weapon")}</span><small>{selectable ? "Click to select on this weapon. " : active ? "Currently selected. " : "Not selectable on this owned roll. "}{rating.reasons[0]}</small></div>, document.body)}
  </>;
}

function TraitMode({ mode, score, exact }: { mode: "E" | "P"; score?: number; exact: boolean }) {
  const state = score === undefined ? "unknown" : exact ? (score === 100 ? "up" : "down") : score >= 60 ? "up" : score <= 25 ? "down" : "mixed";
  const label = mode === "E" ? "PvE" : "PvP";
  const description = `${label}: ${traitModeLabel(score, exact)}`;
  return <span className={styles.traitMode} data-mode={mode === "E" ? "pve" : "pvp"} data-state={state} title={description} aria-label={description}>{state === "up" ? <ThumbsUp /> : state === "down" ? <ThumbsDown /> : <Minus />}</span>;
}

function traitModeLabel(score: number | undefined, exact: boolean): string {
  if (score === undefined) return "unrated";
  if (exact) return score === 100 ? "curator recommended" : "not recommended for this weapon";
  return `${score}% recommendation evidence`;
}

function ratedColumns(weapon: WeaponItem): WeaponPerkColumn[] {
  return weapon.perkColumns.filter((column) => column.ratingColumn !== undefined || column.kind === "origin").sort((left, right) => (left.ratingColumn ?? 4) - (right.ratingColumn ?? 4) || left.socketIndex - right.socketIndex);
}

function uniqueTraitOptions(column: WeaponPerkColumn): ArmorPerk[] {
  const options = column.active ? [column.active, ...column.options] : column.options;
  const available = new Set(column.selectablePlugHashes || []);
  return [...new Map(options
    .filter((perk) => perk.hash && perk.name && (perk.hash === column.active?.hash || available.has(perk.hash)))
    .map((perk) => [perk.hash, perk])).values()];
}

function ratingColumnLabel(weapon: WeaponItem, column: 0 | 1 | 2 | 3): string {
  if (column === 2) return "Trait 1";
  if (column === 3) return "Trait 2";
  const bow = weapon.itemType.includes("Bow");
  if (column === 0) return weapon.itemType === "Sword" ? "Blade" : bow ? "String" : weapon.itemType === "Glaive" ? "Haft" : "Barrel";
  return weapon.itemType === "Sword" ? "Guard" : bow ? "Arrow" : /Fusion Rifle|Trace Rifle/.test(weapon.itemType) ? "Battery" : "Magazine";
}

function columnLabel(weapon: WeaponItem, column: WeaponPerkColumn): string { return column.kind === "origin" ? "Origin Trait" : ratingColumnLabel(weapon, column.ratingColumn ?? 0); }
function originRating(source = "Community wishlists"): WeaponTraitValue { return { state: "unavailable", recommended: false, reasons: [`${source} does not assign PvE or PvP scores to origin traits.`] }; }

function basisLabel(basis: ReturnType<typeof evaluateWeapon>["basis"], itemType: string, source: string): string {
  return basis === "weapon" ? `Exact ${source} weapon` : basis === "weapon-family" ? `Same-name ${source} rolls` : `${itemType} evidence`;
}

function traitTitle(perk: ArmorPerk, rating: WeaponTraitValue, active: boolean): string {
  return [`${perk.name}${active ? ", equipped" : ""}`, `PvE ${traitModeLabel(rating.pve, rating.basis === "weapon")}`, `PvP ${traitModeLabel(rating.pvp, rating.basis === "weapon")}`].join(". ");
}
