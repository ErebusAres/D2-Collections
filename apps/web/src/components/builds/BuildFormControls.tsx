import type { BuildCatalogEntry, BuildCatalogKind, BuildEquipmentEntry, BuildGuardianClass, BuildNamedEntry, BuildSubclass } from "@guardian-nexus/contracts";
import { AlertTriangle, Trash2 } from "lucide-react";
import { namedEntryFromCatalog } from "../../modules/builds/buildCatalog";
import styles from "../../pages/Builds.module.css";
import { isCatalogEntry, ManifestMultiEditor, ManifestPicker } from "./ManifestPicker";

interface SelectorContext {
  classType?: BuildGuardianClass;
  subclass?: BuildSubclass;
  slot?: "helmet" | "arms" | "chest" | "legs" | "classItem";
}

export function NamedEntryEditor({ values, onChange, kind, label, addLabel = "Add choice", placeholder, context, max = 10, requiredToggle = true }: {
  values: BuildNamedEntry[];
  onChange: (values: BuildNamedEntry[]) => void;
  kind: BuildCatalogKind;
  label: string;
  addLabel?: string;
  placeholder: string;
  context?: SelectorContext;
  max?: number;
  requiredToggle?: boolean;
}) {
  return <ManifestMultiEditor values={values} onChange={onChange} kind={kind} label={label} addLabel={addLabel} placeholder={placeholder} context={context} max={max} requiredToggle={requiredToggle} />;
}

export function EquipmentEditor({ values, onChange, addLabel, kind, context }: {
  values: BuildEquipmentEntry[];
  onChange: (values: BuildEquipmentEntry[]) => void;
  addLabel: string;
  kind: "weapon" | "armor";
  context?: SelectorContext;
}) {
  const add = (entry: BuildCatalogEntry | BuildNamedEntry) => {
    const named = isCatalogEntry(entry) ? namedEntryFromCatalog(entry) : entry;
    if (values.some((value) => value.hash && value.hash === named.hash || value.name.toLocaleLowerCase() === named.name.toLocaleLowerCase())) return;
    const definition = isCatalogEntry(entry) ? entry : undefined;
    onChange([...values, {
      ...named,
      slot: definition?.slot || defaultSlot(kind),
      exotic: definition?.exotic || undefined
    }]);
  };
  return <div className={styles.equipmentEditor}>
    {values.map((entry, index) => <article className={styles.equipmentSelection} key={`${entry.hash || entry.name}-${index}`} data-exotic={entry.exotic}>
      {entry.icon ? <img src={entry.icon} alt="" /> : <span className={styles.unavailableManifestIcon}><AlertTriangle /></span>}
      <div className={styles.equipmentIdentity}><strong>{entry.name}</strong><small>{entry.hash ? [entry.itemType, entry.rarity, entry.damageType, `Bungie ${entry.hash}`].filter(Boolean).join(" · ") : "Manual fallback · icon unavailable"}</small></div>
      <label><span>Slot</span><select value={entry.slot} onChange={(event) => replace(values, index, { ...entry, slot: event.target.value }, onChange)}>{slotOptions(kind, entry.slot).map((slot) => <option key={slot}>{slot}</option>)}</select></label>
      <label className={styles.equipmentPerks}><span>{kind === "weapon" ? "Perks / roll" : "Set bonus / configuration"}</span><input value={entry.perks || ""} placeholder={kind === "weapon" ? "Optional recommended roll" : "Optional set details"} onChange={(event) => replace(values, index, { ...entry, perks: event.target.value || undefined }, onChange)} /></label>
      <label className={styles.selectionRequired}><input type="checkbox" checked={Boolean(entry.required)} onChange={(event) => replace(values, index, { ...entry, required: event.target.checked }, onChange)} /> Required</label>
      {entry.exotic && <em>Exotic</em>}
      <button type="button" className={styles.removeField} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${entry.name}`}><Trash2 /></button>
    </article>)}
    <ManifestPicker kind={kind} label={`${addLabel} · ${values.length}/12`} placeholder={`Search official ${kind} definitions…`} context={context} onSelect={add} />
  </div>;
}

function replace<T>(values: T[], index: number, value: T, onChange: (values: T[]) => void): void {
  onChange(values.map((entry, entryIndex) => entryIndex === index ? value : entry));
}

function defaultSlot(kind: "weapon" | "armor"): string {
  return kind === "weapon" ? "Kinetic Weapons" : "Helmet";
}

function slotOptions(kind: "weapon" | "armor", current: string): string[] {
  const values = kind === "weapon"
    ? ["Kinetic Weapons", "Energy Weapons", "Power Weapons"]
    : ["Helmet", "Gauntlets", "Chest Armor", "Leg Armor", "Hunter Cloak", "Titan Mark", "Warlock Bond"];
  return current && !values.includes(current) ? [current, ...values] : values;
}
