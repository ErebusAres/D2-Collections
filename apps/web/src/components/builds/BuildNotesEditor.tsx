import type { BuildDocument, BuildNamedEntry } from "@guardian-nexus/contracts";
import { useRef } from "react";
import { destinyNoteToken } from "./BuildRichNotes";
import { ManifestPicker } from "./ManifestPicker";
import styles from "../../pages/Builds.module.css";

export function BuildNotesEditor({ value, onChange }: { value: BuildDocument; onChange: (value: BuildDocument) => void }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const insert = (entry: BuildNamedEntry) => {
    if (!entry.icon) return;
    const field = textarea.current;
    const start = field?.selectionStart ?? value.notes.length;
    const end = field?.selectionEnd ?? start;
    const token = destinyNoteToken(entry);
    const spacingBefore = start > 0 && !/\s/.test(value.notes[start - 1] || "") ? " " : "";
    const spacingAfter = end < value.notes.length && !/\s/.test(value.notes[end] || "") ? " " : "";
    const next = `${value.notes.slice(0, start)}${spacingBefore}${token}${spacingAfter}${value.notes.slice(end)}`;
    onChange({ ...value, notes: next });
    window.requestAnimationFrame(() => {
      const position = start + spacingBefore.length + token.length + spacingAfter.length;
      field?.focus();
      field?.setSelectionRange(position, position);
    });
  };
  return <div className={styles.notesInsertEditor}>
    {value.concepts.length > 0 && <p className={styles.legacyConceptNotice}>Existing at-a-glance icons are retained for compatibility. New icons are inserted directly into the note at the cursor.</p>}
    <label className={styles.notesField}><span>Main build notes · Markdown-style text, natural emoji, and inline Destiny icons</span><textarea ref={textarea} value={value.notes} onChange={(event) => onChange({ ...value, notes: event.target.value })} placeholder="Explain the gameplay loop, flexible choices, encounter advice, and substitutions in one field guide." /></label>
    <ManifestPicker kind="icon" label="Insert an official Destiny icon at the cursor" placeholder="Search traits, perks, elements, champions, abilities, gear, mods, Artifacts, or engrams…" context={{ classType: value.classType, subclass: value.subclass }} allowManual={false} onSelect={(entry) => insert(entry)} />
  </div>;
}
