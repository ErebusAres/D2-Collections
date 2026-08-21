import type { ArmorPerk, WeaponItem, WeaponPerkColumn } from "@guardian-nexus/contracts";
import { Columns3, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { evaluateWeapon, evaluateWeaponPerk, loadWeaponRatings, qualityLabel, type WeaponRatingDatabase, type WeaponTraitValue } from "../../modules/loot/weaponEvaluator";
import styles from "./WeaponRatingPanel.module.css";

export function WeaponRatingPanel({ weapon, ratings, compact = false, showTraits = true }: { weapon: WeaponItem; ratings?: WeaponRatingDatabase; compact?: boolean; showTraits?: boolean }) {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (ratings) return;
    let cancelled = false;
    void loadWeaponRatings().then(() => { if (!cancelled) rerender((value) => value + 1); });
    return () => { cancelled = true; };
  }, [ratings]);
  const value = evaluateWeapon(weapon, ratings);
  const columns = ratedColumns(weapon);
  return <section className={`${styles.panel} ${compact ? styles.compact : ""}`} data-state={value.state} data-quality={value.quality}>
    <header className={styles.summary}><span><small>Community roll</small><strong>{value.state === "scored" ? `${weapon.rollDataState === "complete" ? "" : "Est. "}${qualityLabel(value.quality)}` : value.state === "incomplete" ? "Pending" : "Unrated"}</strong></span><div className={styles.modeScores}><ModeScore mode="PvE" score={value.pve} /><ModeScore mode="PvP" score={value.pvp} /></div></header>
    {value.state === "scored" && <p className={styles.evidence}>{basisLabel(value.basis, weapon.itemType)} · {value.confidence} confidence · {value.comparedColumns}/{value.totalColumns} columns</p>}
    {showTraits && (columns.length ? <div className={styles.columns}>{columns.map((column) => <TraitColumn key={column.ratingColumn} weapon={weapon} column={column} ratings={ratings} />)}</div> : <p className={styles.pending}>Perk pool unavailable.</p>)}
    {showTraits && columns.length > 0 && <footer className={styles.legend}><span><ThumbsUp /> Recommended</span><span><ThumbsDown /> Not recommended</span><span>Blue = equipped</span></footer>}
  </section>;
}

function ModeScore({ mode, score }: { mode: "PvE" | "PvP"; score?: number }) {
  return <span data-known={score !== undefined}><small>{mode}</small><b>{score === undefined ? "—" : `${score}%`}</b></span>;
}

function TraitColumn({ weapon, column, ratings }: { weapon: WeaponItem; column: WeaponPerkColumn & { ratingColumn: 0 | 1 | 2 | 3 }; ratings?: WeaponRatingDatabase }) {
  const options = uniqueTraitOptions(column);
  return <section className={styles.column}><header><b>{ratingColumnLabel(weapon, column.ratingColumn)}</b><small>{options.length}</small></header><div className={styles.perkGrid}>{options.map((perk) => {
    const rating = evaluateWeaponPerk(weapon, column.ratingColumn, perk.hash, ratings);
    const active = perk.hash === column.active?.hash;
    return <PerkOption key={perk.hash} perk={perk} rating={rating} active={active} />;
  })}</div></section>;
}

function PerkOption({ perk, rating, active }: { perk: ArmorPerk; rating: WeaponTraitValue; active: boolean }) {
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
    <button ref={button} className={styles.perk} type="button" data-active={active} aria-label={traitTitle(perk, rating, active)} aria-describedby={position ? tooltipId : undefined} onMouseEnter={showDetail} onMouseLeave={() => setPosition(undefined)} onFocus={showDetail} onBlur={() => setPosition(undefined)}>
      <span className={styles.perkIcon}>{perk.icon ? <img src={perk.icon} alt="" /> : <Columns3 />}
        <span className={styles.modeMarks}><TraitMode mode="E" score={rating.pve} exact={rating.basis === "weapon"} /><TraitMode mode="P" score={rating.pvp} exact={rating.basis === "weapon"} /></span>
      </span>
    </button>
    {position && createPortal(<div id={tooltipId} role="tooltip" className={styles.perkDetail} data-side={position.side} style={{ top: position.top, left: position.left }}><strong>{perk.name}</strong>{perk.description && <p>{perk.description}</p>}<span><b>PvE</b>{traitModeLabel(rating.pve, rating.basis === "weapon")}</span><span><b>PvP</b>{traitModeLabel(rating.pvp, rating.basis === "weapon")}</span><small>{rating.reasons[0]}</small></div>, document.body)}
  </>;
}

function TraitMode({ mode, score, exact }: { mode: "E" | "P"; score?: number; exact: boolean }) {
  const state = score === undefined ? "unknown" : exact ? (score === 100 ? "up" : "down") : score >= 60 ? "up" : score <= 25 ? "down" : "mixed";
  return <span className={styles.traitMode} data-state={state} title={`${mode === "E" ? "PvE" : "PvP"}: ${traitModeLabel(score, exact)}`}><small>{mode}</small>{state === "up" ? <ThumbsUp /> : state === "down" ? <ThumbsDown /> : <Minus />}</span>;
}

function traitModeLabel(score: number | undefined, exact: boolean): string {
  if (score === undefined) return "unrated";
  if (exact) return score === 100 ? "curator recommended" : "not recommended for this weapon";
  return `${score}% recommendation evidence`;
}

function ratedColumns(weapon: WeaponItem): Array<WeaponPerkColumn & { ratingColumn: 0 | 1 | 2 | 3 }> {
  return weapon.perkColumns.filter((column): column is WeaponPerkColumn & { ratingColumn: 0 | 1 | 2 | 3 } => column.ratingColumn !== undefined).sort((left, right) => left.ratingColumn - right.ratingColumn);
}

function uniqueTraitOptions(column: WeaponPerkColumn): ArmorPerk[] {
  const options = column.active ? [column.active, ...column.options] : column.options;
  return [...new Map(options.filter((perk) => perk.hash && perk.name).map((perk) => [perk.hash, perk])).values()];
}

function ratingColumnLabel(weapon: WeaponItem, column: 0 | 1 | 2 | 3): string {
  if (column === 2) return "Trait 1";
  if (column === 3) return "Trait 2";
  if (column === 0) return weapon.itemType === "Sword" ? "Blade" : weapon.itemType === "Combat Bow" ? "String" : "Barrel";
  return weapon.itemType === "Sword" ? "Guard" : weapon.itemType === "Combat Bow" ? "Arrow" : "Magazine";
}

function basisLabel(basis: ReturnType<typeof evaluateWeapon>["basis"], itemType: string): string {
  return basis === "weapon" ? "Exact DIM weapon" : basis === "weapon-family" ? "Same-name DIM rolls" : `${itemType} evidence`;
}

function traitTitle(perk: ArmorPerk, rating: WeaponTraitValue, active: boolean): string {
  return [`${perk.name}${active ? ", equipped" : ""}`, `PvE ${traitModeLabel(rating.pve, rating.basis === "weapon")}`, `PvP ${traitModeLabel(rating.pvp, rating.basis === "weapon")}`].join(". ");
}
