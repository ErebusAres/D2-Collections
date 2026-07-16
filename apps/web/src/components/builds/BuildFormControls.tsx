import type { BuildArmorSlot, BuildCatalogEntry, BuildCatalogKind, BuildEquipmentEntry, BuildGuardianClass, BuildNamedEntry, BuildSubclass } from "@guardian-nexus/contracts";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { namedEntryFromCatalog } from "../../modules/builds/buildCatalog";
import styles from "../../pages/Builds.module.css";
import { isCatalogEntry, ManifestMultiEditor, ManifestPicker } from "./ManifestPicker";

interface SelectorContext {
  classType?: BuildGuardianClass;
  subclass?: BuildSubclass;
  slot?: BuildArmorSlot;
  itemHash?: string;
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
      {kind === "weapon" && <div className={styles.equipmentPerkSelector}><ManifestMultiEditor kind="weaponPerk" label="Recommended roll" placeholder="Search this weapon's available barrels, magazines, traits, and perks…" context={{ itemHash: entry.hash }} values={entry.selectedPerks || []} onChange={(selectedPerks) => replace(values, index, { ...entry, selectedPerks }, onChange)} addLabel="Roll choices" max={8} requiredToggle={false} /><details><summary>Manual roll note</summary><input value={entry.perks || ""} placeholder="Fallback note for a missing or newly released perk" onChange={(event) => replace(values, index, { ...entry, perks: event.target.value || undefined }, onChange)} /></details></div>}
      <label className={styles.selectionRequired}><input type="checkbox" checked={Boolean(entry.required)} onChange={(event) => replace(values, index, { ...entry, required: event.target.checked }, onChange)} /> Required</label>
      {entry.exotic && <em>Exotic</em>}
      <button type="button" className={styles.removeField} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${entry.name}`}><Trash2 /></button>
    </article>)}
    <ManifestPicker kind={kind} label={`${addLabel} · ${values.length}/12`} placeholder={`Search official ${kind} definitions…`} context={context} onSelect={add} />
  </div>;
}

export function ArmorModEditor({ values, onChange, slot, label }: { values: BuildNamedEntry[]; onChange: (values: BuildNamedEntry[]) => void; slot: BuildArmorSlot; label: string }) {
  const total = values.reduce((sum, entry) => sum + (entry.quantity || 1), 0);
  const changeQuantity = (index: number, delta: number) => {
    const current = values[index];
    if (!current) return;
    const quantity = current.quantity || 1;
    const next = quantity + delta;
    if (next <= 0) onChange(values.filter((_, entryIndex) => entryIndex !== index));
    else if (next <= 3 && total + delta <= 3) onChange(values.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: next } : entry));
  };
  const add = (entry: BuildCatalogEntry | BuildNamedEntry) => {
    const named = isCatalogEntry(entry) ? namedEntryFromCatalog(entry) : entry;
    const index = values.findIndex((value) => (value.hash && value.hash === named.hash) || value.name.toLocaleLowerCase() === named.name.toLocaleLowerCase());
    if (index >= 0) return changeQuantity(index, 1);
    if (total >= 3) return;
    onChange([...values, { ...named, quantity: 1 }]);
  };
  return <div className={styles.armorModEditor}>
    {values.length > 0 && <div className={styles.armorModSelections}>{values.map((entry, index) => <article key={`${entry.hash || entry.name}-${index}`}>
      {entry.icon ? <img src={entry.icon} alt="" /> : <span className={styles.unavailableManifestIcon}><AlertTriangle /></span>}
      <span><strong>{entry.name}</strong><small>{entry.itemType || "Armor mod"}</small></span>
      <span className={styles.modQuantity}><button type="button" onClick={() => changeQuantity(index, -1)} aria-label={`Remove one ${entry.name}`}><Minus /></button><b>×{entry.quantity || 1}</b><button type="button" disabled={total >= 3 || (entry.quantity || 1) >= 3} onClick={() => changeQuantity(index, 1)} aria-label={`Add one ${entry.name}`}><Plus /></button></span>
      <button type="button" className={styles.removeField} onClick={() => onChange(values.filter((_, entryIndex) => entryIndex !== index))} aria-label={`Remove ${entry.name}`}><Trash2 /></button>
    </article>)}</div>}
    {total < 3 ? <ManifestPicker kind="armorMod" label={`${label} · ${total}/3 sockets`} placeholder={`Search cached ${label.toLocaleLowerCase()}…`} context={{ slot }} onSelect={add} /> : <small className={styles.selectorLimit}>{label} complete · 3/3 mod sockets</small>}
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
