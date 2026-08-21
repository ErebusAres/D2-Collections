import type { ArmorPerk, WeaponItem, WeaponPerkColumn } from "@guardian-nexus/contracts";
import { Check, Columns3, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  evaluateWeapon,
  evaluateWeaponPerk,
  loadWeaponRatings,
  qualityLabel,
  type WeaponRatingDatabase,
  type WeaponTraitValue
} from "../../modules/loot/weaponEvaluator";
import styles from "./WeaponRatingPanel.module.css";

export function WeaponRatingPanel({ weapon, ratings, compact = false, showTraits = true }: {
  weapon: WeaponItem;
  ratings?: WeaponRatingDatabase;
  compact?: boolean;
  showTraits?: boolean;
}) {
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
    <header className={styles.summary}>
      <span><small>Community roll match</small><strong>{value.state === "scored" ? `${weapon.rollDataState === "complete" ? "" : "Provisional "}${qualityLabel(value.quality)}` : value.state === "incomplete" ? "Pending" : "Unrated"}</strong></span>
      <div className={styles.modeScores}>
        <ModeScore mode="PvE" score={value.pve} />
        <ModeScore mode="PvP" score={value.pvp} />
      </div>
    </header>
    {value.state === "scored" && <div className={styles.evidence}><span>{basisLabel(value.basis, weapon.itemType)}</span><span>{value.confidence} confidence</span><span>{value.comparedColumns}/{value.totalColumns} columns</span></div>}
    {showTraits && (columns.length ? <div className={styles.columns}>{columns.map((column) => <TraitColumn key={column.socketIndex} weapon={weapon} column={column} ratings={ratings} compact={compact} />)}</div> : <p className={styles.pending}>Selectable perk data is not available in this snapshot.</p>)}
    {!compact && <footer>{value.reasons[0]}{value.source && <small>Source: {value.source} · reviewed {value.reviewedAt}</small>}</footer>}
  </section>;
}

function ModeScore({ mode, score }: { mode: "PvE" | "PvP"; score?: number }) {
  return <span data-known={score !== undefined}><small>{mode}</small><b>{score === undefined ? "—" : `${score}%`}</b></span>;
}

function TraitColumn({ weapon, column, ratings, compact }: {
  weapon: WeaponItem;
  column: WeaponPerkColumn & { ratingColumn: 0 | 1 | 2 | 3 };
  ratings?: WeaponRatingDatabase;
  compact: boolean;
}) {
  const options = uniqueTraitOptions(column);
  return <section className={styles.column}>
    <header><b>{ratingColumnLabel(weapon, column.ratingColumn)}</b><small>{options.length}</small></header>
    <div>{options.map((perk) => {
      const rating = evaluateWeaponPerk(weapon, column.ratingColumn, perk.hash, ratings);
      const active = perk.hash === column.active?.hash;
      return <article key={perk.hash} data-active={active} data-recommended={rating.recommended} title={traitTitle(perk, rating, active)}>
        <span className={styles.perkIcon}>{perk.icon ? <img src={perk.icon} alt="" /> : <Columns3 />}{active && <i><Check /></i>}</span>
        <span className={styles.perkName}><b>{perk.name}</b>{!compact && <small>{active ? "Selected" : "Selectable"}</small>}</span>
        <TraitMode mode="E" score={rating.pve} exact={rating.basis === "weapon"} />
        <TraitMode mode="P" score={rating.pvp} exact={rating.basis === "weapon"} />
      </article>;
    })}</div>
  </section>;
}

function TraitMode({ mode, score, exact }: { mode: "E" | "P"; score?: number; exact: boolean }) {
  const state = score === undefined ? "unknown" : score >= 75 ? "recommended" : score > 0 ? "partial" : "not-listed";
  return <span className={styles.traitMode} data-state={state} aria-label={`${mode === "E" ? "PvE" : "PvP"} ${traitModeLabel(score, exact)}`} title={`${mode === "E" ? "PvE" : "PvP"}: ${traitModeLabel(score, exact)}`}>
    <small>{mode}</small>{score === undefined ? <Minus /> : <b>{exact ? (score === 100 ? "✓" : "·") : score}</b>}
  </span>;
}

function traitModeLabel(score: number | undefined, exact: boolean): string {
  if (score === undefined) return "unrated";
  if (exact) return score === 100 ? "curator recommended" : "not listed by the curator";
  return `${score}% community evidence`;
}

function ratedColumns(weapon: WeaponItem): Array<WeaponPerkColumn & { ratingColumn: 0 | 1 | 2 | 3 }> {
  return weapon.perkColumns
    .filter((column): column is WeaponPerkColumn & { ratingColumn: 0 | 1 | 2 | 3 } => column.ratingColumn !== undefined)
    .sort((left, right) => left.ratingColumn - right.ratingColumn);
}

function uniqueTraitOptions(column: WeaponPerkColumn): ArmorPerk[] {
  const options = column.active ? [column.active, ...column.options] : column.options;
  return [...new Map(options.filter((perk) => perk.hash && perk.name).map((perk) => [perk.hash, perk])).values()];
}

function ratingColumnLabel(weapon: WeaponItem, column: 0 | 1 | 2 | 3): string {
  if (column === 2) return "Trait 1";
  if (column === 3) return "Trait 2";
  if (column === 0) return weapon.itemType === "Sword" ? "Blade" : weapon.itemType === "Combat Bow" ? "String" : "Barrel / Sight";
  return weapon.itemType === "Sword" ? "Guard" : weapon.itemType === "Combat Bow" ? "Arrow" : "Magazine / Battery";
}

function basisLabel(basis: ReturnType<typeof evaluateWeapon>["basis"], itemType: string): string {
  return basis === "weapon" ? "Exact weapon" : basis === "weapon-family" ? "Same-name reissue" : `${itemType} fallback`;
}

function traitTitle(perk: ArmorPerk, rating: WeaponTraitValue, active: boolean): string {
  const pve = traitModeLabel(rating.pve, rating.basis === "weapon");
  const pvp = traitModeLabel(rating.pvp, rating.basis === "weapon");
  return [`${perk.name}${active ? " (selected)" : ""}`, perk.description, `PvE: ${pve}. PvP: ${pvp}.`, rating.reasons[0]].filter(Boolean).join(" · ");
}
