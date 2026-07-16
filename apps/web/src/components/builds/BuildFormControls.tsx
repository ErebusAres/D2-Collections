import type { BuildEquipmentEntry, BuildNamedEntry } from "@guardian-nexus/contracts";
import { CirclePlus, Trash2 } from "lucide-react";
import styles from "../../pages/Builds.module.css";

export function NamedEntryEditor({ values, onChange, addLabel = "Add choice", slotLabel }: { values: BuildNamedEntry[]; onChange: (values: BuildNamedEntry[]) => void; addLabel?: string; slotLabel?: string }) {
  return <div className={styles.repeater}>
    {values.map((entry, index) => <div className={styles.repeaterRow} key={index}>
      <label><span>{slotLabel || "Name"}</span><input value={entry.name} required onChange={(event) => replace(values, index, { ...entry, name: event.target.value }, onChange)} /></label>
      <label><span>Icon URL</span><input type="url" value={entry.icon || ""} placeholder="Optional Bungie icon URL" onChange={(event) => replace(values, index, { ...entry, icon: event.target.value || undefined }, onChange)} /></label>
      <label className={styles.wideField}><span>Notes</span><input value={entry.notes || ""} placeholder="Why this choice matters" onChange={(event) => replace(values, index, { ...entry, notes: event.target.value || undefined }, onChange)} /></label>
      <label className={styles.checkField}><input type="checkbox" checked={Boolean(entry.required)} onChange={(event) => replace(values, index, { ...entry, required: event.target.checked }, onChange)} /><span>Required</span></label>
      <button type="button" className={styles.removeField} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${entry.name || "entry"}`}><Trash2 /></button>
    </div>)}
    <button type="button" className={styles.addField} onClick={() => onChange([...values, { name: "" }])}><CirclePlus /> {addLabel}</button>
  </div>;
}

export function EquipmentEditor({ values, onChange, addLabel }: { values: BuildEquipmentEntry[]; onChange: (values: BuildEquipmentEntry[]) => void; addLabel: string }) {
  return <div className={styles.repeater}>
    {values.map((entry, index) => <div className={styles.repeaterRow} key={index}>
      <label><span>Slot</span><input value={entry.slot} required placeholder="Kinetic / Helmet" onChange={(event) => replace(values, index, { ...entry, slot: event.target.value }, onChange)} /></label>
      <label><span>Item</span><input value={entry.name} required onChange={(event) => replace(values, index, { ...entry, name: event.target.value }, onChange)} /></label>
      <label><span>Icon URL</span><input type="url" value={entry.icon || ""} onChange={(event) => replace(values, index, { ...entry, icon: event.target.value || undefined }, onChange)} /></label>
      <label className={styles.wideField}><span>Perks / roll</span><input value={entry.perks || ""} onChange={(event) => replace(values, index, { ...entry, perks: event.target.value || undefined }, onChange)} /></label>
      <label className={styles.wideField}><span>Notes</span><input value={entry.notes || ""} onChange={(event) => replace(values, index, { ...entry, notes: event.target.value || undefined }, onChange)} /></label>
      <label className={styles.checkField}><input type="checkbox" checked={Boolean(entry.required)} onChange={(event) => replace(values, index, { ...entry, required: event.target.checked }, onChange)} /><span>Required</span></label>
      <label className={styles.checkField}><input type="checkbox" checked={Boolean(entry.exotic)} onChange={(event) => replace(values, index, { ...entry, exotic: event.target.checked }, onChange)} /><span>Exotic</span></label>
      <button type="button" className={styles.removeField} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${entry.name || "item"}`}><Trash2 /></button>
    </div>)}
    <button type="button" className={styles.addField} onClick={() => onChange([...values, { name: "", slot: "" }])}><CirclePlus /> {addLabel}</button>
  </div>;
}

function replace<T>(values: T[], index: number, value: T, onChange: (values: T[]) => void): void {
  onChange(values.map((entry, entryIndex) => entryIndex === index ? value : entry));
}
