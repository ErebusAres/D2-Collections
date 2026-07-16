import type { GearTag } from "@guardian-nexus/contracts";
import { Archive, ArrowUpCircle, Check, CircleOff, Star, Tag, Tags, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./GearTagPicker.module.css";

const GEAR_TAGS: ReadonlyArray<{ value: GearTag; label: string }> = [
  { value: "favorite", label: "Favorite" },
  { value: "keep", label: "Keep" },
  { value: "junk", label: "Junk" },
  { value: "infuse", label: "Infuse" },
  { value: "archive", label: "Archive" }
];

type GearTagFilterValue = "all" | "none" | GearTag;

export function GearTagPicker({ value, onChange, disabled = false }: { value?: GearTag; onChange: (value?: GearTag) => void; disabled?: boolean }) {
  const options: Array<{ value?: GearTag; label: string }> = [{ label: "No tag" }, ...GEAR_TAGS];
  const selected = GEAR_TAGS.find((option) => option.value === value);
  return <TagSelector
    value={value || "none"}
    label={selected?.label || "Add tag"}
    options={options.map((option) => ({ value: option.value || "none", label: option.label, tag: option.value }))}
    onChange={(next) => onChange(next === "none" ? undefined : next as GearTag)}
    disabled={disabled}
  />;
}

export function GearTagFilter({ value, onChange }: { value: GearTagFilterValue; onChange: (value: GearTagFilterValue) => void }) {
  const options: Array<{ value: GearTagFilterValue; label: string; tag?: GearTag }> = [
    { value: "all", label: "All tags" },
    { value: "none", label: "Untagged" },
    ...GEAR_TAGS.map((option) => ({ ...option, tag: option.value }))
  ];
  const selected = options.find((option) => option.value === value) || options[0]!;
  return <TagSelector value={value} label={selected.label} options={options} onChange={(next) => onChange(next as GearTagFilterValue)} filter />;
}

export function GearTagBadge({ tag }: { tag?: GearTag }) {
  if (!tag) return null;
  const label = GEAR_TAGS.find((option) => option.value === tag)?.label || tag;
  return <span className={`${styles.badge} ${styles[tag]}`} title={`${label} tag`} aria-label={`${label} tag`}><TagIcon tag={tag} /></span>;
}

function TagSelector({ value, label, options, onChange, disabled = false, filter = false }: {
  value: string;
  label: string;
  options: Array<{ value: string; label: string; tag?: GearTag }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  filter?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selectedTag = options.find((option) => option.value === value)?.tag;
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", closeOutside); window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  return <div ref={root} className={`${styles.picker} ${filter ? styles.filter : ""} ${styles[selectedTag || value] || styles.none}`}>
    <button type="button" className={styles.trigger} disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{selectedTag ? <TagIcon tag={selectedTag} /> : filter && value === "all" ? <Tags /> : filter ? <CircleOff /> : <Tag />}<span>{label}</span></button>
    {open && <div className={styles.menu} role="menu">{options.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === value} className={`${option.value === value ? styles.selected : ""} ${styles[option.tag || option.value] || styles.none}`} onClick={() => { onChange(option.value); setOpen(false); }}>{option.tag ? <TagIcon tag={option.tag} /> : option.value === "all" ? <Tags /> : <CircleOff />}<span>{option.label}</span>{option.value === value && <Check />}</button>)}</div>}
  </div>;
}

function TagIcon({ tag }: { tag: GearTag }) {
  if (tag === "favorite") return <Star fill="currentColor" />;
  if (tag === "keep") return <Tag fill="currentColor" />;
  if (tag === "junk") return <Trash2 />;
  if (tag === "infuse") return <ArrowUpCircle />;
  return <Archive />;
}
