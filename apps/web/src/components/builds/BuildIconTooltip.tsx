import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import { CircleHelp } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import styles from "../../pages/Builds.module.css";

export function BuildIconTooltip({ entry, label, related = [], badge }: { entry?: BuildNamedEntry; label: string; related?: BuildNamedEntry[]; badge?: string }) {
  const name = entry?.name || "Any";
  const tooltipId = useId();
  const trigger = useRef<HTMLSpanElement>(null);
  const popover = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(290, window.innerWidth - 24);
    setPopoverStyle({ display: "grid", position: "fixed", visibility: "hidden", width, maxHeight: window.innerHeight - 24, overflowY: "auto", left: 12, top: 12 });
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    setPopoverStyle(undefined);
  };
  useLayoutEffect(() => {
    if (!open || !trigger.current || !popover.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const tooltip = popover.current.getBoundingClientRect();
    const width = Math.min(290, window.innerWidth - 24);
    const height = Math.min(Math.max(tooltip.height, 1), window.innerHeight - 24);
    const spaceBelow = window.innerHeight - anchor.bottom - 12;
    const spaceAbove = anchor.top - 12;
    const placeBelow = spaceBelow >= height || spaceBelow >= spaceAbove;
    const proposedTop = placeBelow ? anchor.bottom + 6 : anchor.top - height - 6;
    setPopoverStyle((current) => ({
      ...current,
      visibility: "visible",
      left: Math.max(12, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(proposedTop, window.innerHeight - height - 12))
    }));
  }, [open, entry, related.length]);
  return <span ref={trigger} className={styles.buildIconTooltip} tabIndex={0} aria-label={`${label}: ${name}`} aria-describedby={tooltipId} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onKeyDown={(event) => event.key === "Escape" && hide()}>
    <span className={styles.buildIconFace}>{entry?.icon ? <img src={entry.icon} alt="" loading="lazy" /> : <CircleHelp />}{badge && <b>{badge}</b>}</span>
    <span ref={popover} id={tooltipId} className={styles.buildIconPopover} role="tooltip" style={popoverStyle}>
      <small>{label}{entry?.rarity ? ` · ${entry.rarity}` : ""}</small>
      <strong>{name}</strong>
      {entry && <em>{[entry.itemType, entry.damageType].filter(Boolean).join(" · ") || "Destiny build selection"}</em>}
      {entry?.description && <p>{entry.description}</p>}
      {entry?.notes && <p>{entry.notes}</p>}
      {related.length > 0 && <span className={styles.buildIconRelated}>{related.map((item, index) => <span key={`${item.hash || item.name}-${index}`}>{item.icon ? <img src={item.icon} alt="" /> : <CircleHelp />}<span><b>{item.name}</b>{item.description && <small>{item.description}</small>}</span></span>)}</span>}
    </span>
  </span>;
}
