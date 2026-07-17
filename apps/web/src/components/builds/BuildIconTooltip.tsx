import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import { CircleHelp } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";
import styles from "../../pages/Builds.module.css";

export function BuildIconTooltip({ entry, label, related = [], badge }: { entry?: BuildNamedEntry; label: string; related?: BuildNamedEntry[]; badge?: string }) {
  const name = entry?.name || "Any";
  const tooltipId = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
  const open = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(290, window.innerWidth - 24);
    setPopoverStyle({ display: "grid", position: "fixed", width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: rect.bottom + 326 < window.innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - 326) });
  };
  return <span ref={trigger} className={styles.buildIconTooltip} tabIndex={0} aria-label={`${label}: ${name}`} aria-describedby={tooltipId} onMouseEnter={open} onMouseLeave={() => setPopoverStyle(undefined)} onFocus={open} onBlur={() => setPopoverStyle(undefined)} onKeyDown={(event) => event.key === "Escape" && setPopoverStyle(undefined)}>
    <span className={styles.buildIconFace}>{entry?.icon ? <img src={entry.icon} alt="" loading="lazy" /> : <CircleHelp />}{badge && <b>{badge}</b>}</span>
    <span id={tooltipId} className={styles.buildIconPopover} role="tooltip" style={popoverStyle}>
      <small>{label}{entry?.rarity ? ` · ${entry.rarity}` : ""}</small>
      <strong>{name}</strong>
      {entry && <em>{[entry.itemType, entry.damageType].filter(Boolean).join(" · ") || "Destiny build selection"}</em>}
      {entry?.description && <p>{entry.description}</p>}
      {entry?.notes && <p>{entry.notes}</p>}
      {related.length > 0 && <span className={styles.buildIconRelated}>{related.map((item, index) => <span key={`${item.hash || item.name}-${index}`}>{item.icon ? <img src={item.icon} alt="" /> : <CircleHelp />}<span><b>{item.name}</b>{item.description && <small>{item.description}</small>}</span></span>)}</span>}
    </span>
  </span>;
}
