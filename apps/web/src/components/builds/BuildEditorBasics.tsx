import type { BuildDocument } from "@guardian-nexus/contracts";
import { CirclePlus, Link2, MessageSquareText, Tags, Trash2 } from "lucide-react";
import styles from "../../pages/Builds.module.css";
import { BuildIdentitySelector } from "./BuildIdentitySelector";
import { BuildTagInput } from "./BuildTagInput";
import { BuildNotesEditor } from "./BuildNotesEditor";

export function BuildEditorBasics({ value, onChange }: { value: BuildDocument; onChange: (value: BuildDocument) => void }) {
  const set = <K extends keyof BuildDocument>(key: K, next: BuildDocument[K]) => onChange({ ...value, [key]: next });
  return <>
    <EditorSection title="Basics" eyebrow="Required identity" icon={<Tags />} open>
      <div className={styles.formGrid}>
        <label className={styles.wideField}><span>Build title *</span><input value={value.title} required minLength={3} maxLength={120} onChange={(event) => set("title", event.target.value)} placeholder="e.g. Prismatic GM support loop" /></label>
        <div className={styles.fullField}><BuildIdentitySelector value={value} onChange={onChange} /></div>
        <label><span>Original creator</span><input value={value.originalCreatorName || ""} onChange={(event) => set("originalCreatorName", event.target.value || undefined)} placeholder="If different from the editor" /></label>
        <div className={styles.wideField}><BuildTagInput label="Tags * · commas, #hashtags, or pasted lists" values={value.tags} required onChange={(tags) => set("tags", tags)} placeholder="pve, #gm, boss-dps, grenade spam" /></div>
        <div className={styles.wideField}><BuildTagInput label="Activities" values={value.activityTags} onChange={(activityTags) => set("activityTags", activityTags)} placeholder="PvE, Raid, Dungeon, GM, Solo" /></div>
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
      <BuildNotesEditor value={value} onChange={onChange} />
    </EditorSection>
  </>;
}

export function EditorSection({ title, eyebrow, icon, children, open = false }: { title: string; eyebrow: string; icon: React.ReactNode; children: React.ReactNode; open?: boolean }) {
  return <details className={styles.editorSection} open={open}><summary><i>{icon}</i><span><small>{eyebrow}</small><strong>{title}</strong></span><em>Open section</em></summary><div className={styles.editorSectionBody}>{children}</div></details>;
}
