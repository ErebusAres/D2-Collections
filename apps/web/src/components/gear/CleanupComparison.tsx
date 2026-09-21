import type { CleanupAnalysis, CleanupRecommendation, WeaponItem } from "@guardian-nexus/contracts";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LootItem } from "./RecentLoot";
import styles from "./CleanupComparison.module.css";

export function availableCleanupPlugs(item: WeaponItem, index: number) {
  const column = item.perkColumns.find((entry) => entry.socketIndex === index);
  return (column?.selectablePlugHashes || []).map((hash) => {
    const plug = column?.options.find((option) => option.hash === hash) || (column?.active?.hash === hash ? column.active : undefined);
    return { hash, name: plug?.name || `Unresolved trait (${hash})`, icon: plug?.icon, equipped: column?.active?.hash === hash };
  });
}

export function CleanupComparison({ candidate, keeper, recommendation, sources, onClose }: { candidate: LootItem; keeper: LootItem; recommendation: CleanupRecommendation; sources: CleanupAnalysis["sources"]; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === "Tab") {
        const controls = [...(panel.current?.querySelectorAll<HTMLElement>("button, a[href], [tabindex='0']") || [])];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      // Inspection must not trigger the selected loot card's transfer/tag shortcuts.
      if (event.key.toLowerCase() === "p" || (event.shiftKey && /^[1-5]$/.test(event.key))) event.stopImmediatePropagation();
    };
    document.addEventListener("keydown", keydown, true);
    return () => { document.removeEventListener("keydown", keydown, true); previous?.focus(); };
  }, [onClose]);
  const row = (label: string, a: ReactNode, b: ReactNode, delta?: number) => <tr key={label}><th scope="row">{label}</th><td>{a}</td><td>{b}{delta !== undefined && delta !== 0 && <span className={styles.delta} data-positive={delta > 0}> {delta > 0 ? "+" : ""}{delta}</span>}</td></tr>;
  const armor = candidate.kind === "armor" && keeper.kind === "armor";
  const weapon = candidate.kind === "weapon" && keeper.kind === "weapon";
  const sockets = weapon ? [...new Set([...candidate.perkColumns, ...keeper.perkColumns].map((column) => column.socketIndex))].sort((a, b) => a - b) : [];
  const plugs = (item: WeaponItem, other: WeaponItem, index: number) => {
    const otherHashes = new Set(availableCleanupPlugs(other, index).map((plug) => plug.hash));
    return <div className={styles.plugs}>{availableCleanupPlugs(item, index).map((plug) => <span key={plug.hash} data-equipped={plug.equipped} data-unique={!otherHashes.has(plug.hash)} title={`${plug.name}${plug.equipped ? " · Equipped" : ""}${!otherHashes.has(plug.hash) ? " · Only on this copy" : ""}`}>{plug.icon && <img src={plug.icon} alt="" />}<span>{plug.name}{!otherHashes.has(plug.hash) && <small>Only on this copy</small>}</span></span>)}</div>;
  };
  return createPortal(<div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-label="Cleanup comparison">
    <header><div><h2>Why keep this copy?</h2><p>{recommendation.reason}</p></div><button ref={closeButton} type="button" onClick={onClose}>Close comparison</button></header>
    <p>{recommendation.confidence}% rules-based confidence — not a measured probability. Nothing is dismantled by this comparison.</p>
    {recommendation.protections.length > 0 && <p>Review only: {recommendation.protections.join(", ")}.</p>}
    <table><thead><tr><th scope="col">Comparison</th>{[candidate, keeper].map((item, index) => <th scope="col" key={item.instanceId}><span className={styles.item}>{item.icon && <img src={item.icon} alt="" />}<span><small>{index === 0 ? "Recommended for review" : "Retained keeper"}</small><strong>{item.name}</strong><small>{item.instanceId}</small></span></span></th>)}</tr></thead><tbody>
      {row("Power", candidate.power, keeper.power, keeper.power - candidate.power)}
      {row("Location", candidate.location, keeper.location)}
      {row("Tier", candidate.gearTier || "Not provided", keeper.gearTier || "Not provided")}
      {row("Masterworked", candidate.masterworked ? "Yes" : "No", keeper.masterworked ? "Yes" : "No")}
      {armor && <>{row("Class / slot", `${candidate.className} · ${candidate.slot}`, `${keeper.className} · ${keeper.slot}`)}{row("Archetype", candidate.archetype?.name || "Not provided", keeper.archetype?.name || "Not provided")}{row("Bonus stat / tuning", candidate.tunedStat || candidate.tuning?.name || "None reported", keeper.tunedStat || keeper.tuning?.name || "None reported")}{Object.entries(candidate.baseStats).map(([stat, value]) => row(`Base ${stat}`, value, keeper.baseStats[stat as keyof typeof keeper.baseStats], keeper.baseStats[stat as keyof typeof keeper.baseStats] - value))}{row("Base total", candidate.baseTotal, keeper.baseTotal, keeper.baseTotal - candidate.baseTotal)}</>}
      {weapon && <>{row("Crafted / enhanced", `${candidate.crafted ? "Crafted" : "Not crafted"} / ${candidate.enhanced ? "Enhanced" : "Not enhanced"}`, `${keeper.crafted ? "Crafted" : "Not crafted"} / ${keeper.enhanced ? "Enhanced" : "Not enhanced"}`)}{row("Masterwork", candidate.masterwork?.name || "None reported", keeper.masterwork?.name || "None reported")}{row("Recorded tracker", candidate.trackerValue ?? "Not reported", keeper.trackerValue ?? "Not reported")}{sockets.map((index) => { const column = candidate.perkColumns.find((c) => c.socketIndex === index) || keeper.perkColumns.find((c) => c.socketIndex === index); return row(`${column?.kind || "Attachment / trait"} · socket ${index + 1}`, plugs(candidate, keeper, index), plugs(keeper, candidate, index)); })}</>}
    </tbody></table>
    <p>{weapon ? "All selectable options on these specific copies are shown, not hypothetical rolls. Blue marks the equipped option; unique options are labeled." : "Armor comparisons use base stats and compatible fits, not total stats alone. Green/red differences are keeper minus candidate."}</p>
    <p>{recommendation.confidence === 70 && weapon ? `Rating sources: ${sources.map((source) => `${source.name} (${source.reviewedAt})`).join(", ")}` : "Source: local comparison of your owned items. No wishlist score was used for this comparison."}</p>
  </div></div>, document.body);
}
