import type { BuildDocument } from "@guardian-nexus/contracts";
import { CirclePlus, Link2, MessageSquareText, Tags, Trash2 } from "lucide-react";
import { splitTags, titleCase } from "../../modules/builds/builds";
import styles from "../../pages/Builds.module.css";

const concepts = ["⚔️ damage", "🛡️ survivability", "💥 add clear", "🎯 boss DPS", "◆ champion", "◉ orb generation", "👊 melee loop", "◌ grenade loop", "◇ class ability loop", "✨ super spam", "▣ ammo economy", "✚ healing", "woven mail", "devour", "radiant", "volatile", "jolt", "scorch / ignition", "freeze / shatter", "sever / unravel", "suspend"];

export function BuildEditorBasics({ value, onChange }: { value: BuildDocument; onChange: (value: BuildDocument) => void }) {
  const set = <K extends keyof BuildDocument>(key: K, next: BuildDocument[K]) => onChange({ ...value, [key]: next });
  return <>
    <EditorSection title="Basics" eyebrow="Required identity" icon={<Tags />} open>
      <div className={styles.formGrid}>
        <label className={styles.wideField}><span>Build title *</span><input value={value.title} required minLength={3} maxLength={120} onChange={(event) => set("title", event.target.value)} placeholder="e.g. Prismatic GM support loop" /></label>
        <label><span>Class *</span><select value={value.classType} onChange={(event) => set("classType", event.target.value as BuildDocument["classType"])}>{["hunter", "titan", "warlock"].map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
        <label><span>Subclass *</span><select value={value.subclass} onChange={(event) => set("subclass", event.target.value as BuildDocument["subclass"])}>{["prismatic", "arc", "solar", "void", "strand", "stasis"].map((entry) => <option key={entry} value={entry}>{titleCase(entry)}</option>)}</select></label>
        <label><span>Subclass icon URL</span><input type="url" value={value.subclassIcon || ""} onChange={(event) => set("subclassIcon", event.target.value || undefined)} placeholder="Optional manifest icon" /></label>
        <label><span>Original creator</span><input value={value.originalCreatorName || ""} onChange={(event) => set("originalCreatorName", event.target.value || undefined)} placeholder="If different from the editor" /></label>
        <label className={styles.wideField}><span>Tags * · comma or # separated</span><input value={value.tags.join(", ")} required onChange={(event) => set("tags", splitTags(event.target.value))} placeholder="support, GM, ability-loop" /></label>
        <label className={styles.wideField}><span>Activities</span><input value={value.activityTags.join(", ")} onChange={(event) => set("activityTags", splitTags(event.target.value))} placeholder="PvE, Raid, Dungeon, GM, Solo" /></label>
        <label className={styles.fullField}><span>Card summary</span><textarea value={value.summary} maxLength={600} onChange={(event) => set("summary", event.target.value)} placeholder="A short at-a-glance explanation of what this build does." /></label>
      </div>
    </EditorSection>

    <EditorSection title="Links" eyebrow="Sources and utilities" icon={<Link2 />}>
      <div className={styles.repeater}>{value.links.map((link, index) => <div className={styles.repeaterRow} key={index}>
        <label><span>Type</span><select value={link.kind} onChange={(event) => set("links", value.links.map((item, itemIndex) => itemIndex === index ? { ...item, kind: event.target.value as typeof item.kind } : item))}>{["dim", "mobalytics", "youtube", "twitch", "source", "other"].map((kind) => <option key={kind}>{kind}</option>)}</select></label>
        <label><span>Label</span><input required value={link.label} onChange={(event) => set("links", value.links.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></label>
        <label className={styles.wideField}><span>HTTPS URL</span><input required type="url" value={link.url} onChange={(event) => set("links", value.links.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} /></label>
        <button type="button" className={styles.removeField} onClick={() => set("links", value.links.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button>
      </div>)}<button type="button" className={styles.addField} onClick={() => set("links", [...value.links, { kind: "dim", label: "DIM", url: "" }])}><CirclePlus /> Add external link</button></div>
    </EditorSection>

    <EditorSection title="Notes" eyebrow="Readable field guide" icon={<MessageSquareText />}>
      <div className={styles.quickConcepts}>{concepts.map((concept) => <button type="button" key={concept} onClick={() => set("notes", `${value.notes}${value.notes ? "\n" : ""}${concept}`)}>{concept}</button>)}</div>
      <label className={styles.notesField}><span>Build notes · plain text and emoji render safely</span><textarea value={value.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Explain the role, ability economy, flexible choices, and encounter advice." /></label>
    </EditorSection>
  </>;
}

export function EditorSection({ title, eyebrow, icon, children, open = false }: { title: string; eyebrow: string; icon: React.ReactNode; children: React.ReactNode; open?: boolean }) {
  return <details className={styles.editorSection} open={open}><summary><i>{icon}</i><span><small>{eyebrow}</small><strong>{title}</strong></span><em>Open section</em></summary><div className={styles.editorSectionBody}>{children}</div></details>;
}
