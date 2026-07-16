import type { BuildStatPriority } from "@guardian-nexus/contracts";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useState } from "react";
import { buildStatIcon, normalizeBuildStatPriorities } from "../../modules/builds/buildStats";
import styles from "../../pages/Builds.module.css";

export function BuildStatPriorityEditor({ values, onChange }: { values: BuildStatPriority[]; onChange: (values: BuildStatPriority[]) => void }) {
  const ordered = normalizeBuildStatPriorities(values);
  const [dragging, setDragging] = useState<string>();
  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= ordered.length || to >= ordered.length) return;
    const next = [...ordered];
    const [entry] = next.splice(from, 1);
    if (!entry) return;
    next.splice(to, 0, entry);
    onChange(next.map((stat, index) => ({ ...stat, priority: index + 1 })));
  };
  const update = (index: number, key: "minimum" | "target" | "maximum", raw: string) => {
    onChange(ordered.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: raw === "" ? undefined : Number(raw) } : entry));
  };
  return <div className={styles.statPriorityEditor}>
    <p>Drag the six fixed Destiny stats into priority order. Priority 1 is highest; priority 6 is lowest.</p>
    <div>{ordered.map((stat, index) => <article
      key={stat.stat}
      draggable
      data-dragging={dragging === stat.stat}
      onDragStart={() => setDragging(stat.stat)}
      onDragEnd={() => setDragging(undefined)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => { move(ordered.findIndex((entry) => entry.stat === dragging), index); setDragging(undefined); }}
    >
      <span className={styles.statDragHandle}><GripVertical /><b>{index + 1}</b></span>
      <span className={styles.statIdentity}><img src={stat.icon || buildStatIcon(stat.stat)} alt="" /><strong>{stat.stat}</strong></span>
      {(["minimum", "target", "maximum"] as const).map((key) => <label key={key}><span>{key}</span><input type="number" min={0} max={999} value={stat[key] ?? ""} onChange={(event) => update(index, key, event.target.value)} /></label>)}
      <span className={styles.statMoveButtons}><button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${stat.stat} up`}><ChevronUp /></button><button type="button" disabled={index === ordered.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${stat.stat} down`}><ChevronDown /></button></span>
    </article>)}</div>
  </div>;
}
