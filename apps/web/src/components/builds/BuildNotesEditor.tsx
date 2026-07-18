import type { BuildDocument, BuildNamedEntry } from "@guardian-nexus/contracts";
import { Bold, Code2, Heading1, Heading2, Italic, Link2, List, ListOrdered, Pilcrow, Quote, Smile, Strikethrough, Underline } from "lucide-react";
import { useRef, useState } from "react";
import { destinyNoteToken } from "./BuildRichNotes";
import { BuildNotesIconPicker } from "./BuildNotesIconPicker";
import styles from "../../pages/Builds.module.css";

export function BuildNotesEditor({ value, onChange }: { value: BuildDocument; onChange: (value: BuildDocument) => void }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [showIcons, setShowIcons] = useState(false);
  const replace = (text: string, selectionStart: number, selectionEnd: number) => {
    const next = `${value.notes.slice(0, selectionStart)}${text}${value.notes.slice(selectionEnd)}`;
    onChange({ ...value, notes: next });
    window.requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(selectionStart + text.length, selectionStart + text.length);
    });
  };
  const wrap = (before: string, after = before, fallback = "text") => {
    const field = textarea.current;
    const start = field?.selectionStart ?? value.notes.length;
    const end = field?.selectionEnd ?? start;
    const selected = value.notes.slice(start, end) || fallback;
    replace(`${before}${selected}${after}`, start, end);
  };
  const block = (prefix: string) => {
    const field = textarea.current;
    const start = field?.selectionStart ?? value.notes.length;
    const lineStart = value.notes.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    replace(prefix, lineStart, lineStart);
  };
  const insert = (entry: BuildNamedEntry) => {
    if (!entry.icon) return;
    const field = textarea.current;
    const start = field?.selectionStart ?? value.notes.length;
    const end = field?.selectionEnd ?? start;
    const token = destinyNoteToken(entry);
    const spacingBefore = start > 0 && !/\s/.test(value.notes[start - 1] || "") ? " " : "";
    const spacingAfter = end < value.notes.length && !/\s/.test(value.notes[end] || "") ? " " : "";
    replace(`${spacingBefore}${token}${spacingAfter}`, start, end);
  };
  const insertEmoji = (emoji: string) => {
    const field = textarea.current;
    const start = field?.selectionStart ?? value.notes.length;
    const end = field?.selectionEnd ?? start;
    replace(emoji, start, end);
  };
  const insertAlias = (alias: string) => {
    const field = textarea.current;
    const start = field?.selectionStart ?? value.notes.length;
    const end = field?.selectionEnd ?? start;
    const spacingBefore = start > 0 && !/\s/.test(value.notes[start - 1] || "") ? " " : "";
    const spacingAfter = end < value.notes.length && !/\s/.test(value.notes[end] || "") ? " " : "";
    replace(`${spacingBefore}:${alias}:${spacingAfter}`, start, end);
  };
  return <div className={styles.notesInsertEditor}>
    {value.concepts.length > 0 && <p className={styles.legacyConceptNotice}>Existing at-a-glance icons are retained for compatibility. New icons are inserted directly into the note at the cursor.</p>}
    <div className={styles.notesToolbar} role="toolbar" aria-label="Build notes formatting">
      <button type="button" title="Bold" aria-label="Bold" onClick={() => wrap("**")}><Bold /></button>
      <button type="button" title="Italic" aria-label="Italic" onClick={() => wrap("*")}><Italic /></button>
      <button type="button" title="Underline" aria-label="Underline" onClick={() => wrap("[u]", "[/u]")}><Underline /></button>
      <button type="button" title="Strikethrough" aria-label="Strikethrough" onClick={() => wrap("~~")}><Strikethrough /></button>
      <i />
      <button type="button" title="Heading" aria-label="Heading" onClick={() => block("# ")}><Heading1 /></button>
      <button type="button" title="Subheading" aria-label="Subheading" onClick={() => block("## ")}><Heading2 /></button>
      <button type="button" title="Paragraph" aria-label="Paragraph" onClick={() => block("\n")}><Pilcrow /></button>
      <button type="button" title="Bulleted list" aria-label="Bulleted list" onClick={() => block("- ")}><List /></button>
      <button type="button" title="Numbered list" aria-label="Numbered list" onClick={() => block("1. ")}><ListOrdered /></button>
      <button type="button" title="Quote" aria-label="Quote" onClick={() => block("> ")}><Quote /></button>
      <button type="button" title="Inline code" aria-label="Inline code" onClick={() => wrap("`")}><Code2 /></button>
      <button type="button" title="Link (edit the URL after inserting)" aria-label="Link" onClick={() => wrap("[url=https://]", "[/url]", "link text")}><Link2 /></button>
      <select aria-label="Font size" defaultValue="" onChange={(event) => { if (event.target.value) wrap(`[size=${event.target.value}]`, "[/size]"); event.target.value = ""; }}><option value="">Size</option><option value="small">Small</option><option value="large">Large</option><option value="x-large">Extra large</option></select>
      <select aria-label="Font" defaultValue="" onChange={(event) => { if (event.target.value) wrap(`[font=${event.target.value}]`, "[/font]"); event.target.value = ""; }}><option value="">Font</option><option value="barlow">Barlow</option><option value="condensed">Barlow Condensed</option><option value="mono">Monospace</option></select>
      <button type="button" className={styles.notesEmojiButton} data-active={showIcons} title="Emoji and Destiny icons" aria-label="Emoji and Destiny icons" aria-expanded={showIcons} onClick={() => setShowIcons((current) => !current)}><Smile /></button>
    </div>
    <label className={styles.notesField}><span>Main build notes · Markdown, safe BBCode, natural emoji, and inline Destiny icons</span><textarea ref={textarea} value={value.notes} onChange={(event) => onChange({ ...value, notes: event.target.value })} placeholder="Explain the gameplay loop, flexible choices, encounter advice, and substitutions in one field guide." /></label>
    {showIcons && <BuildNotesIconPicker classType={value.classType} subclass={value.subclass} onIcon={insert} onEmoji={insertEmoji} onAlias={insertAlias} />}
  </div>;
}
