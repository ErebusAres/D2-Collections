import type { BuildArmorSlot, BuildCatalogEntry, BuildCatalogKind, BuildGuardianClass, BuildNamedEntry, BuildSubclass } from "@guardian-nexus/contracts";
import { AlertTriangle, Check, Search, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { namedEntryFromCatalog, useBuildCatalog } from "../../modules/builds/buildCatalog";
import styles from "../../pages/Builds.module.css";

interface PickerContext {
  classType?: BuildGuardianClass;
  subclass?: BuildSubclass;
  slot?: BuildArmorSlot;
  itemHash?: string;
  spiritRow?: 1 | 2;
}

export function ManifestPicker({ kind, label, placeholder, onSelect, context, allowManual = true, filterEntry }: {
  kind: BuildCatalogKind;
  label: string;
  placeholder: string;
  onSelect: (entry: BuildCatalogEntry | BuildNamedEntry) => void;
  context?: PickerContext;
  allowManual?: boolean;
  filterEntry?: (entry: BuildCatalogEntry) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const result = useBuildCatalog({ kind, query, enabled: focused, ...context });
  const entries = (result.data?.data.results || []).filter((entry) => !filterEntry || filterEntry(entry));
  const choose = (entry: BuildCatalogEntry | BuildNamedEntry) => {
    onSelect(entry);
    setQuery("");
  };
  return <label className={styles.manifestPicker}>
    <span>{label}</span>
    <div className={styles.manifestSearchInput}><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setFocused(true)} onBlur={() => window.setTimeout(() => setFocused(false), 120)} placeholder={placeholder} role="combobox" aria-expanded={focused} /></div>
    {focused && <div className={styles.manifestResults}>
      {result.isLoading && <p>Searching the current Bungie manifest…</p>}
      {result.error && <p className={styles.manifestUnavailable}><AlertTriangle /> The cached Destiny catalog is temporarily unavailable. {allowManual ? "Manual entry remains available." : "Try the official selector again shortly."}</p>}
      {!result.isLoading && !result.error && entries.map((entry) => <button type="button" key={`${entry.kind}-${entry.hash}-${entry.requiredPieces || 0}`} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(entry)}>
        <img src={entry.icon} alt="" loading="lazy" /><span><strong>{entry.name}</strong><small>{[entry.itemType, entry.rarity, entry.slot, entry.damageType].filter(Boolean).join(" · ")}</small>{entry.description && <small>{entry.description}</small>}</span>{entry.exotic && <em>Exotic</em>}
      </button>)}
      {!result.isLoading && !result.error && focused && !entries.length && <p>{["icon", "noteIcon"].includes(kind) && query.trim().length < 2 ? "Type at least two characters to find a Destiny icon." : "No official definition matches this search."}</p>}
      {allowManual && query.trim().length >= 2 && <button type="button" className={styles.manualManifestEntry} onMouseDown={(event) => event.preventDefault()} onClick={() => choose({ name: query.trim() })}><Wrench /><span><strong>Use “{query.trim()}” manually</strong><small>No fabricated or placeholder icon will be added.</small></span></button>}
    </div>}
  </label>;
}

export function ManifestSingleEditor({ value, onChange, kind, label, placeholder, context, required = false }: {
  value?: BuildNamedEntry;
  onChange: (value?: BuildNamedEntry, catalogEntry?: BuildCatalogEntry) => void;
  kind: BuildCatalogKind;
  label: string;
  placeholder: string;
  context?: PickerContext;
  required?: boolean;
}) {
  return <div className={styles.manifestSingleEditor}>
    {value ? <SelectedManifestEntry value={value} required={required} onRemove={() => onChange(undefined)} /> : <ManifestPicker kind={kind} label={label} placeholder={placeholder} context={context} onSelect={(entry) => onChange(isCatalogEntry(entry) ? namedEntryFromCatalog(entry) : entry, isCatalogEntry(entry) ? entry : undefined)} />}
  </div>;
}

export function ManifestMultiEditor({ values, onChange, kind, label, addLabel, placeholder, context, max = 20, requiredToggle = false }: {
  values: BuildNamedEntry[];
  onChange: (values: BuildNamedEntry[]) => void;
  kind: BuildCatalogKind;
  label: string;
  addLabel: string;
  placeholder: string;
  context?: PickerContext;
  max?: number;
  requiredToggle?: boolean;
}) {
  const add = (entry: BuildCatalogEntry | BuildNamedEntry) => {
    const next = isCatalogEntry(entry) ? namedEntryFromCatalog(entry) : entry;
    if (values.some((value) => value.hash && value.hash === next.hash || value.name.toLocaleLowerCase() === next.name.toLocaleLowerCase())) return;
    onChange([...values, next].slice(0, max));
  };
  return <div className={styles.manifestMultiEditor}>
    {values.length > 0 && <div className={styles.manifestSelections}>{values.map((entry, index) => <SelectedManifestEntry key={`${entry.hash || entry.name}-${index}`} value={entry} required={requiredToggle ? entry.required : undefined} onRequiredChange={requiredToggle ? (required) => onChange(values.map((value, valueIndex) => valueIndex === index ? { ...value, required } : value)) : undefined} onRemove={() => onChange(values.filter((_, valueIndex) => valueIndex !== index))} />)}</div>}
    {values.length < max && <ManifestPicker kind={kind} label={`${label} · ${values.length}/${max}`} placeholder={placeholder} context={context} onSelect={add} />}
    {values.length >= max && <small className={styles.selectorLimit}><Check /> {addLabel} complete · maximum {max}</small>}
  </div>;
}

function SelectedManifestEntry({ value, onRemove, required, onRequiredChange }: { value: BuildNamedEntry; onRemove: () => void; required?: boolean; onRequiredChange?: (required: boolean) => void }) {
  return <article className={styles.manifestSelection} data-manual={!value.hash}>
    {value.icon ? <img src={value.icon} alt="" /> : <span className={styles.unavailableManifestIcon}><AlertTriangle /></span>}
    <span><strong>{value.name}</strong><small>{value.hash ? [value.itemType, value.rarity, value.damageType, `Bungie ${value.hash}`].filter(Boolean).join(" · ") : "Manual fallback · icon unavailable"}</small></span>
    {onRequiredChange && <label className={styles.selectionRequired}><input type="checkbox" checked={Boolean(required)} onChange={(event) => onRequiredChange(event.target.checked)} /> Required</label>}
    <button type="button" onClick={onRemove} aria-label={`Remove ${value.name}`}><Trash2 /></button>
  </article>;
}

export function isCatalogEntry(entry: BuildCatalogEntry | BuildNamedEntry): entry is BuildCatalogEntry {
  return "kind" in entry;
}
