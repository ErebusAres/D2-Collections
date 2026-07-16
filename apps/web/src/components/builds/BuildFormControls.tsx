import type { BuildArmorSlot, BuildCatalogEntry, BuildCatalogKind, BuildEquipmentEntry, BuildGuardianClass, BuildNamedEntry, BuildSubclass } from "@guardian-nexus/contracts";
import { AlertTriangle, Trash2 } from "lucide-react";
import { namedEntryFromCatalog } from "../../modules/builds/buildCatalog";
import styles from "../../pages/Builds.module.css";
import { addArmorSetSelection, armorSetOptionAllowed, normalizeArmorSetSelections } from "../../modules/builds/armorSetBonuses";
import { isCatalogEntry, ManifestMultiEditor, ManifestPicker, ManifestSingleEditor } from "./ManifestPicker";

interface SelectorContext {
  classType?: BuildGuardianClass;
  subclass?: BuildSubclass;
  slot?: BuildArmorSlot;
  itemHash?: string;
  spiritRow?: 1 | 2;
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
      exotic: definition?.exotic || undefined,
      traits: definition?.traits
    }]);
  };
  return <div className={styles.equipmentEditor}>
    {values.map((entry, index) => <article className={styles.equipmentSelection} key={`${entry.hash || entry.name}-${index}`} data-exotic={entry.exotic}>
      {entry.icon ? <img src={entry.icon} alt="" /> : <span className={styles.unavailableManifestIcon}><AlertTriangle /></span>}
      <div className={styles.equipmentIdentity}><strong>{entry.name}</strong><small>{entry.hash ? [entry.itemType, entry.rarity, entry.damageType, `Bungie ${entry.hash}`].filter(Boolean).join(" · ") : "Manual fallback · icon unavailable"}</small></div>
      <label><span>Slot</span><select value={entry.slot} onChange={(event) => replace(values, index, { ...entry, slot: event.target.value }, onChange)}>{slotOptions(kind, entry.slot).map((slot) => <option key={slot}>{slot}</option>)}</select></label>
      {kind === "weapon" && <div className={styles.equipmentPerkSelector}><ManifestMultiEditor kind="weaponPerk" label="Recommended roll" placeholder="Search this weapon's available barrels, magazines, traits, and perks…" context={{ itemHash: entry.hash }} values={entry.selectedPerks || []} onChange={(selectedPerks) => replace(values, index, { ...entry, selectedPerks }, onChange)} addLabel="Roll choices" max={8} requiredToggle={false} /><details><summary>Manual roll note</summary><input value={entry.perks || ""} placeholder="Fallback note for a missing or newly released perk" onChange={(event) => replace(values, index, { ...entry, perks: event.target.value || undefined }, onChange)} /></details></div>}
      {kind === "armor" && entry.traits?.length ? <div className={styles.equipmentTraits}><small>Inherent trait</small>{entry.traits.map((trait) => <span key={trait.hash || trait.name}>{trait.icon ? <img src={trait.icon} alt="" /> : <AlertTriangle />}<strong>{trait.name}</strong></span>)}</div> : null}
      {kind === "armor" && entry.exotic && isClassItem(entry.slot) ? <div className={styles.spiritSelectors}>{([1, 2] as const).map((row) => <ManifestSingleEditor key={row} kind="exoticSpirit" label={`Spirit row ${row}`} placeholder={`Search row ${row} Spirits…`} context={{ itemHash: entry.hash, spiritRow: row }} value={(entry.selectedSpirits || []).find((spirit) => spirit.row === row)} onChange={(spirit) => replace(values, index, { ...entry, selectedSpirits: spirit ? [...(entry.selectedSpirits || []).filter((value) => value.row !== row), { ...spirit, row }] : (entry.selectedSpirits || []).filter((value) => value.row !== row) }, onChange)} />)}</div> : null}
      <label className={styles.selectionRequired}><input type="checkbox" checked={Boolean(entry.required)} onChange={(event) => replace(values, index, { ...entry, required: event.target.checked }, onChange)} /> Required</label>
      {entry.exotic && <em>Exotic</em>}
      <button type="button" className={styles.removeField} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${entry.name}`}><Trash2 /></button>
    </article>)}
    <ManifestPicker kind={kind} label={`${addLabel} · ${values.length}/12`} placeholder={`Search official ${kind} definitions…`} context={context} onSelect={add} />
  </div>;
}

export function ArmorModEditor({ values, onChange, slot, label }: { values: BuildNamedEntry[]; onChange: (values: BuildNamedEntry[]) => void; slot: BuildArmorSlot; label: string }) {
  const expanded = expandBuildEntries(values);
  const total = expanded.length;
  const add = (entry: BuildCatalogEntry | BuildNamedEntry) => {
    const named = isCatalogEntry(entry) ? namedEntryFromCatalog(entry) : entry;
    if (total >= 3) return;
    onChange([...expanded, { ...named, quantity: undefined }]);
  };
  return <div className={styles.armorModEditor}>
    {expanded.length > 0 && <div className={styles.armorModSelections}>{expanded.map((entry, index) => <article key={`${entry.hash || entry.name}-${index}`}>
      {entry.icon ? <img src={entry.icon} alt="" /> : <span className={styles.unavailableManifestIcon}><AlertTriangle /></span>}
      <span><strong>{entry.name}</strong><small>{entry.itemType || "Armor mod"} · socket {index + 1}</small></span>
      <button type="button" className={styles.removeField} onClick={() => onChange(expanded.filter((_, entryIndex) => entryIndex !== index))} aria-label={`Remove ${entry.name}`}><Trash2 /></button>
    </article>)}</div>}
    {total < 3 ? <ManifestPicker kind="armorMod" label={`${label} · ${total}/3 sockets`} placeholder={`Search cached ${label.toLocaleLowerCase()}…`} context={{ slot }} onSelect={add} /> : <small className={styles.selectorLimit}>{label} complete · 3/3 mod sockets</small>}
  </div>;
}

export function ArmorSetBonusEditor({ values, onChange, classType }: { values: BuildNamedEntry[]; onChange: (values: BuildNamedEntry[]) => void; classType: BuildGuardianClass }) {
  const selected = normalizeArmorSetSelections(values);
  const add = (entry: BuildCatalogEntry | BuildNamedEntry) => {
    const next = isCatalogEntry(entry) ? namedEntryFromCatalog(entry) : entry;
    onChange(addArmorSetSelection(selected, next));
  };
  const remove = (index: number) => {
    const remaining = selected.filter((_, entryIndex) => index !== entryIndex);
    onChange(index === 0 && remaining[0]?.requiredPieces === 4 ? [] : remaining);
  };
  return <div className={styles.armorSetEditor}>
    <p>Slot 1 is a 2-piece bonus. Slot 2 may be another set's 2-piece bonus or the same set's 4-piece bonus.</p>
    {selected.length > 0 && <div className={styles.manifestSelections}>{selected.map((entry, index) => <article className={styles.manifestSelection} key={`${entry.hash}-${entry.requiredPieces}-${index}`}>{entry.icon ? <img src={entry.icon} alt="" /> : <AlertTriangle />}<span><strong>{entry.setName || entry.name}</strong><small>Slot {index + 1} · {entry.requiredPieces}-piece bonus · {entry.name}</small></span><button type="button" onClick={() => remove(index)} aria-label={`Remove ${entry.requiredPieces}-piece ${entry.setName || entry.name} bonus`}><Trash2 /></button></article>)}</div>}
    {selected.length < 2 && <ManifestPicker kind="armorSetBonus" label={selected.length ? "Second set bonus · 2 of another set or 4 of this set" : "First set bonus · choose a 2-piece bonus"} placeholder="Search armor set bonuses…" context={{ classType }} onSelect={add} allowManual={false} filterEntry={(entry) => armorSetOptionAllowed(selected, namedEntryFromCatalog(entry))} />}
  </div>;
}

export function expandBuildEntries(values: BuildNamedEntry[]): BuildNamedEntry[] {
  return values.flatMap((entry) => Array.from({ length: Math.max(1, entry.quantity || 1) }, () => ({ ...entry, quantity: undefined })));
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

function isClassItem(slot: string): boolean {
  return /cloak|mark|bond|class armor|class item/i.test(slot);
}
