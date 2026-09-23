import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import styles from "./CleanupSelect.module.css";

/** Searchable desktop picker; keeps the option markup readable at call sites. */
export function CleanupSelect({ value, onChange, children, icons = {} }: { value: string | number; onChange: (event: { target: { value: string } }) => void; children: ReactNode; icons?: Record<string, Array<{ icon: string; name: string }>> }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const root = useRef<HTMLSpanElement>(null), search = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const options = Children.toArray(children).filter(isValidElement<{ value: string | number; children: ReactNode }>).map((child) => ({ value: String(child.props.value), label: Children.toArray(child.props.children).join("") }));
  const selected = options.find((option) => option.value === String(value));
  const thumbnails = (key: string) => icons[key]?.length ? <span className={styles.thumbnails}>{icons[key]!.map((image, index) => <img key={`${image.icon}:${index}`} src={image.icon} alt="" title={image.name} loading="lazy" />)}</span> : null;
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <span ref={root} className={styles.picker} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <button type="button" ref={trigger} className={styles.trigger} aria-expanded={open} aria-controls={id} onClick={() => { setOpen(!open); setQuery(""); }}><span>{thumbnails(String(value))}{selected?.label || "Choose…"}</span><ChevronDown size={14} /></button>
    {open && <span id={id} className={styles.menu} role="group" aria-label="Available choices">
      <span className={styles.search}><Search size={14} /><input ref={search} aria-label="Search choices" placeholder="Search…" value={query} onChange={(event) => setQuery(event.target.value)} /></span>
      <span className={styles.options}>{options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())).map((option) => <button type="button" className={styles.option} key={option.value} aria-pressed={option.value === String(value)} onClick={() => { onChange({ target: { value: option.value } }); setOpen(false); trigger.current?.focus(); }}><span>{thumbnails(option.value)}{option.label}</span>{option.value === String(value) && <Check size={14} />}</button>)}</span>
      {!options.some((option) => option.label.toLowerCase().includes(query.toLowerCase())) && <span className={styles.empty}>No matching choices</span>}
    </span>}
  </span>;
}
