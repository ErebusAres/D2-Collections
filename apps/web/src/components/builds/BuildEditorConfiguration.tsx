import type { BuildArmorMods, BuildDocument, BuildNamedEntry } from "@guardian-nexus/contracts";
import { CalendarClock, CirclePlus, Footprints, Gauge, PackageOpen, Palette, Puzzle, Sparkles, Swords, Trash2 } from "lucide-react";
import { EditorSection } from "./BuildEditorBasics";
import { EquipmentEditor, NamedEntryEditor } from "./BuildFormControls";
import styles from "../../pages/Builds.module.css";

export function BuildEditorConfiguration({ value, onChange }: { value: BuildDocument; onChange: (value: BuildDocument) => void }) {
  const set = <K extends keyof BuildDocument>(key: K, next: BuildDocument[K]) => onChange({ ...value, [key]: next });
  const setSubclass = <K extends keyof BuildDocument["subclassConfig"]>(key: K, next: BuildDocument["subclassConfig"][K]) => set("subclassConfig", { ...value.subclassConfig, [key]: next });
  return <>
    <EditorSection title="Subclass" eyebrow="Ability configuration" icon={<Sparkles />}>
      <div className={styles.subsectionGrid}>{(["super", "classAbility", "movement", "melee", "grenade"] as const).map((key) => <div key={key}><h3>{labelFor(key)}</h3><OptionalEntry value={value.subclassConfig[key]} onChange={(entry) => setSubclass(key, entry)} /></div>)}</div>
      <h3>Aspects</h3><NamedEntryEditor values={value.subclassConfig.aspects} onChange={(entries) => setSubclass("aspects", entries)} addLabel="Add aspect" />
      <h3>Fragments</h3><NamedEntryEditor values={value.subclassConfig.fragments} onChange={(entries) => setSubclass("fragments", entries)} addLabel="Add fragment" />
      <label className={styles.notesField}><span>Why these choices?</span><textarea value={value.subclassConfig.notes || ""} onChange={(event) => setSubclass("notes", event.target.value || undefined)} /></label>
    </EditorSection>

    <EditorSection title="Equipment" eyebrow="Weapons and armor" icon={<Swords />}>
      <h3>Weapons</h3><EquipmentEditor values={value.equipment.weapons} onChange={(weapons) => set("equipment", { ...value.equipment, weapons })} addLabel="Add weapon" />
      <h3>Armor</h3><EquipmentEditor values={value.equipment.armor} onChange={(armor) => set("equipment", { ...value.equipment, armor })} addLabel="Add armor" />
      <h3>Sets and bonuses</h3><NamedEntryEditor values={value.equipment.armorSets} onChange={(armorSets) => set("equipment", { ...value.equipment, armorSets })} addLabel="Add armor set" />
    </EditorSection>

    <EditorSection title="Stats" eyebrow="Priorities and thresholds" icon={<Gauge />}>
      <div className={styles.repeater}>{value.statPriorities.map((stat, index) => <div className={styles.repeaterRow} key={index}>
        <label><span>Priority</span><input type="number" min={1} max={20} value={stat.priority} onChange={(event) => set("statPriorities", value.statPriorities.map((item, itemIndex) => itemIndex === index ? { ...item, priority: Number(event.target.value) } : item))} /></label>
        <label><span>Stat</span><input value={stat.stat} placeholder="Grenade" onChange={(event) => set("statPriorities", value.statPriorities.map((item, itemIndex) => itemIndex === index ? { ...item, stat: event.target.value } : item))} /></label>
        {(["minimum", "target", "maximum"] as const).map((key) => <label key={key}><span>{labelFor(key)}</span><input type="number" min={0} max={999} value={stat[key] ?? ""} onChange={(event) => set("statPriorities", value.statPriorities.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value ? Number(event.target.value) : undefined } : item))} /></label>)}
        <label className={styles.wideField}><span>Notes</span><input value={stat.notes || ""} onChange={(event) => set("statPriorities", value.statPriorities.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value || undefined } : item))} /></label>
        <button type="button" className={styles.removeField} onClick={() => set("statPriorities", value.statPriorities.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button>
      </div>)}<button type="button" className={styles.addField} onClick={() => set("statPriorities", [...value.statPriorities, { stat: "", priority: value.statPriorities.length + 1 }])}><CirclePlus /> Add stat priority</button></div>
    </EditorSection>

    <EditorSection title="Armor mods" eyebrow="Slot-by-slot energy" icon={<Puzzle />}>
      {(Object.keys(value.armorMods) as (keyof BuildArmorMods)[]).map((slot) => <div key={slot}><h3>{labelFor(slot)}</h3><NamedEntryEditor values={value.armorMods[slot]} onChange={(entries) => set("armorMods", { ...value.armorMods, [slot]: entries })} addLabel={`Add ${labelFor(slot).toLowerCase()} mod`} /></div>)}
    </EditorSection>

    <EditorSection title="Artifact" eyebrow="Post-June-9 tablets and perks" icon={<PackageOpen />}>
      <div className={styles.artifactEditors}>{value.artifacts.map((artifact, artifactIndex) => <article key={artifactIndex}>
        <header><strong>Artifact / tablet {artifactIndex + 1}</strong><button type="button" onClick={() => set("artifacts", value.artifacts.filter((_, index) => index !== artifactIndex))}><Trash2 /> Remove</button></header>
        <div className={styles.formGrid}><label><span>Name</span><input value={artifact.name} onChange={(event) => updateArtifact(value, artifactIndex, { ...artifact, name: event.target.value }, set)} /></label><label><span>Tier / group</span><input value={artifact.tier || ""} onChange={(event) => updateArtifact(value, artifactIndex, { ...artifact, tier: event.target.value || undefined }, set)} /></label><label className={styles.wideField}><span>Icon URL</span><input type="url" value={artifact.icon || ""} onChange={(event) => updateArtifact(value, artifactIndex, { ...artifact, icon: event.target.value || undefined }, set)} /></label><label className={styles.fullField}><span>Selection notes</span><textarea value={artifact.notes || ""} onChange={(event) => updateArtifact(value, artifactIndex, { ...artifact, notes: event.target.value || undefined }, set)} /></label></div>
        <h3>Selected perks</h3><NamedEntryEditor values={artifact.perks} onChange={(perks) => updateArtifact(value, artifactIndex, { ...artifact, perks }, set)} addLabel="Add selected perk" />
      </article>)}</div>
      <button type="button" className={styles.addField} onClick={() => set("artifacts", [...value.artifacts, { name: "", perks: [] }])}><CirclePlus /> Add Artifact / tablet</button>
    </EditorSection>

    <EditorSection title="Gameplay loop" eyebrow="Ordered combat rotation" icon={<Footprints />}>
      <div className={styles.repeater}>{value.gameplayLoop.map((step, index) => <div className={styles.repeaterRow} key={index}><i className={styles.stepNumber}>{index + 1}</i><label className={styles.wideField}><span>Step</span><input value={step.text} onChange={(event) => set("gameplayLoop", value.gameplayLoop.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} placeholder="Spam class ability / ??? / Profit" /></label><label><span>Icon URL</span><input type="url" value={step.icon || ""} onChange={(event) => set("gameplayLoop", value.gameplayLoop.map((item, itemIndex) => itemIndex === index ? { ...item, icon: event.target.value || undefined } : item))} /></label><button type="button" className={styles.removeField} onClick={() => set("gameplayLoop", value.gameplayLoop.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div>)}<button type="button" className={styles.addField} onClick={() => set("gameplayLoop", [...value.gameplayLoop, { text: "" }])}><CirclePlus /> Add loop step</button></div>
    </EditorSection>

    <EditorSection title="Cosmetics" eyebrow="Optional Guardian style" icon={<Palette />}>
      <div className={styles.subsectionGrid}>{(["shader", "ghost", "sparrow", "ship"] as const).map((key) => <div key={key}><h3>{labelFor(key)}</h3><OptionalEntry value={value.cosmetics[key]} onChange={(entry) => set("cosmetics", { ...value.cosmetics, [key]: entry })} /></div>)}</div>
      <h3>Ornaments</h3><NamedEntryEditor values={value.cosmetics.ornaments} onChange={(ornaments) => set("cosmetics", { ...value.cosmetics, ornaments })} addLabel="Add ornament" />
      <label className={styles.notesField}><span>Fashion notes</span><textarea value={value.cosmetics.notes || ""} onChange={(event) => set("cosmetics", { ...value.cosmetics, notes: event.target.value || undefined })} /></label>
    </EditorSection>

    <EditorSection title="Versioning" eyebrow="Patch and changelog" icon={<CalendarClock />}>
      <div className={styles.formGrid}><label><span>Patch / episode</span><input value={value.patch || ""} onChange={(event) => set("patch", event.target.value || undefined)} /></label><label className={styles.checkField}><input type="checkbox" checked={value.outdated} onChange={(event) => set("outdated", event.target.checked)} /><span>Mark this build outdated</span></label></div>
      <div className={styles.repeater}>{value.changelog.map((entry, index) => <div className={styles.repeaterRow} key={index}><label><span>Version</span><input value={entry.version || ""} onChange={(event) => set("changelog", value.changelog.map((item, itemIndex) => itemIndex === index ? { ...item, version: event.target.value || undefined } : item))} /></label><label><span>Date</span><input type="date" value={entry.date.slice(0, 10)} onChange={(event) => set("changelog", value.changelog.map((item, itemIndex) => itemIndex === index ? { ...item, date: new Date(`${event.target.value}T00:00:00.000Z`).toISOString() } : item))} /></label><label className={styles.wideField}><span>Changes</span><input value={entry.notes} onChange={(event) => set("changelog", value.changelog.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item))} /></label><button type="button" className={styles.removeField} onClick={() => set("changelog", value.changelog.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div>)}<button type="button" className={styles.addField} onClick={() => set("changelog", [...value.changelog, { date: new Date().toISOString(), notes: "" }])}><CirclePlus /> Add changelog entry</button></div>
    </EditorSection>
  </>;
}

function OptionalEntry({ value, onChange }: { value?: BuildNamedEntry; onChange: (value?: BuildNamedEntry) => void }) {
  return <NamedEntryEditor values={value ? [value] : []} onChange={(entries) => onChange(entries[0])} addLabel="Add choice" />;
}

function updateArtifact(value: BuildDocument, index: number, artifact: BuildDocument["artifacts"][number], set: <K extends keyof BuildDocument>(key: K, next: BuildDocument[K]) => void): void {
  set("artifacts", value.artifacts.map((item, itemIndex) => itemIndex === index ? artifact : item));
}

function labelFor(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
}
