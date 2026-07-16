import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import { CircleHelp } from "lucide-react";
import styles from "../../pages/Builds.module.css";

export function BuildIconTooltip({ entry, label, related = [], badge }: { entry?: BuildNamedEntry; label: string; related?: BuildNamedEntry[]; badge?: string }) {
  const name = entry?.name || "Any";
  return <span className={styles.buildIconTooltip} tabIndex={0} aria-label={`${label}: ${name}`}>
    <span className={styles.buildIconFace}>{entry?.icon ? <img src={entry.icon} alt="" loading="lazy" /> : <CircleHelp />}{badge && <b>{badge}</b>}</span>
    <span className={styles.buildIconPopover} role="tooltip">
      <small>{label}{entry?.rarity ? ` · ${entry.rarity}` : ""}</small>
      <strong>{name}</strong>
      {entry && <em>{[entry.itemType, entry.damageType].filter(Boolean).join(" · ") || "Destiny build selection"}</em>}
      {entry?.description && <p>{entry.description}</p>}
      {entry?.notes && <p>{entry.notes}</p>}
      {related.length > 0 && <span className={styles.buildIconRelated}>{related.map((item, index) => <span key={`${item.hash || item.name}-${index}`}>{item.icon ? <img src={item.icon} alt="" /> : <CircleHelp />}<span><b>{item.name}</b>{item.description && <small>{item.description}</small>}</span></span>)}</span>}
    </span>
  </span>;
}
