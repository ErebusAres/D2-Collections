import type { BuildArmorMods, BuildCatalogEntry, BuildCatalogKind, BuildDocument, BuildNamedEntry } from "@guardian-nexus/contracts";
import { BadgeCheck, CalendarClock, CirclePlus, Footprints, Gauge, PackageOpen, Palette, Puzzle, Sparkles, Swords, Trash2 } from "lucide-react";
import { namedEntryFromCatalog } from "../../modules/builds/buildCatalog";
import { EditorSection } from "./BuildEditorBasics";
import { ArmorModEditor, ArmorSetBonusEditor, EquipmentEditor, NamedEntryEditor } from "./BuildFormControls";
import { isCatalogEntry, ManifestPicker, ManifestSingleEditor } from "./ManifestPicker";
import { ArtifactPerkPicker } from "./ArtifactPerkPicker";
import { BuildStatPriorityEditor } from "./BuildStatPriorityEditor";
import styles from "../../pages/Builds.module.css";

export function BuildEditorConfiguration({ value, onChange }: { value: BuildDocument; onChange: (value: BuildDocument) => void }) {
  const set = <K extends keyof BuildDocument>(key: K, next: BuildDocument[K]) => onChange({ ...value, [key]: next });
  const setSubclass = <K extends keyof BuildDocument["subclassConfig"]>(key: K, next: BuildDocument["subclassConfig"][K]) => set("subclassConfig", { ...value.subclassConfig, [key]: next });
  const abilityKeys = value.subclass === "prismatic"
    ? (["super", "transcendence", "classAbility", "movement", "melee", "grenade"] as const)
    : (["super", "classAbility", "movement", "melee", "grenade"] as const);
  return <>
    <EditorSection title="Subclass" eyebrow="Ability configuration" icon={<Sparkles />}>
      <div className={styles.subsectionGrid}>{abilityKeys.map((key) => <div key={key}><h3>{labelFor(key)}</h3>{key === "transcendence"
        ? <div className={styles.identityManifestPreview}>{value.subclassConfig.transcendence?.icon ? <img src={value.subclassConfig.transcendence.icon} alt="" /> : <Sparkles />}<span><strong>Transcendence</strong><small><BadgeCheck /> Included automatically for Prismatic</small></span></div>
        : <OptionalEntry kind={key} label={labelFor(key)} placeholder={`Search ${labelFor(key).toLowerCase()} definitions…`} context={{ classType: value.classType, subclass: value.subclass }} value={value.subclassConfig[key]} onChange={(entry) => setSubclass(key, entry)} />}</div>)}</div>
      <h3>Aspects</h3><NamedEntryEditor kind="aspect" label="Selected aspects" placeholder="Search official aspects…" context={{ classType: value.classType, subclass: value.subclass }} values={value.subclassConfig.aspects} onChange={(entries) => setSubclass("aspects", entries)} addLabel="Aspects" max={2} />
      <h3>Fragments</h3><NamedEntryEditor kind="fragment" label="Selected fragments" placeholder="Search official fragments…" context={{ classType: value.classType, subclass: value.subclass }} values={value.subclassConfig.fragments} onChange={(entries) => setSubclass("fragments", entries)} addLabel="Fragments" max={8} />
    </EditorSection>

    <EditorSection title="Equipment" eyebrow="Weapons and armor" icon={<Swords />}>
      <h3>Weapons</h3><EquipmentEditor kind="weapon" values={value.equipment.weapons} onChange={(weapons) => set("equipment", { ...value.equipment, weapons })} addLabel="Add weapon" />
      <h3>Armor</h3><EquipmentEditor kind="armor" context={{ classType: value.classType }} values={value.equipment.armor} onChange={(armor) => set("equipment", { ...value.equipment, armor })} addLabel="Add armor" />
      <h3>Set bonuses</h3><ArmorSetBonusEditor classType={value.classType} values={value.equipment.armorSets} onChange={(armorSets) => set("equipment", { ...value.equipment, armorSets })} />
    </EditorSection>

    <EditorSection title="Stats" eyebrow="Priorities and thresholds" icon={<Gauge />}>
      <BuildStatPriorityEditor values={value.statPriorities} onChange={(statPriorities) => set("statPriorities", statPriorities)} />
    </EditorSection>

    <EditorSection title="Armor mods" eyebrow="Slot-by-slot energy" icon={<Puzzle />}>
      {(Object.keys(value.armorMods) as (keyof BuildArmorMods)[]).map((slot) => <div key={slot}><h3>{labelFor(slot)}</h3><ArmorModEditor slot={slot} label={`${labelFor(slot)} mods`} values={value.armorMods[slot]} onChange={(entries) => set("armorMods", { ...value.armorMods, [slot]: entries })} /></div>)}
    </EditorSection>

    <EditorSection title="Artifact" eyebrow="Post-June-9 tablets and perks" icon={<PackageOpen />}>
      <div className={styles.artifactEditors}>{value.artifacts.map((artifact, artifactIndex) => <article key={artifactIndex}>
        <header><span className={styles.artifactIdentity}>{artifact.icon ? <img src={artifact.icon} alt="" /> : <PackageOpen />}<span><small>{artifact.tier || "Artifact / tablet"}</small><strong>{artifact.name}</strong></span></span><button type="button" onClick={() => set("artifacts", value.artifacts.filter((_, index) => index !== artifactIndex))}><Trash2 /> Remove</button></header>
        <ArtifactPerkPicker artifactHash={artifact.hash} artifactName={artifact.name} values={artifact.perks} onChange={(perks) => updateArtifact(value, artifactIndex, { ...artifact, perks }, set)} />
      </article>)}</div>
      <ManifestPicker kind="artifact" label={`Add current Artifact · ${value.artifacts.length}/7`} placeholder="Search the seven current Artifact definitions…" onSelect={(entry) => addArtifact(value, entry, set)} allowManual={false} />
    </EditorSection>

    <EditorSection title="Gameplay loop" eyebrow="Ordered combat rotation" icon={<Footprints />}>
      <div className={styles.repeater}>{value.gameplayLoop.map((step, index) => <div className={styles.repeaterRow} key={index}><i className={styles.stepNumber}>{index + 1}</i><label className={styles.wideField}><span>Step</span><input value={step.text} onChange={(event) => set("gameplayLoop", value.gameplayLoop.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} placeholder="Describe this part of the rotation" /></label><button type="button" className={styles.removeField} onClick={() => set("gameplayLoop", value.gameplayLoop.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div>)}<button type="button" className={styles.addField} onClick={() => set("gameplayLoop", [...value.gameplayLoop, { text: "" }])}><CirclePlus /> Add loop step</button></div>
    </EditorSection>

    <EditorSection title="Cosmetics" eyebrow="Optional Guardian style" icon={<Palette />}>
      <div className={styles.subsectionGrid}>{(["shader", "ghost", "sparrow", "ship"] as const).map((key) => <div key={key}><h3>{labelFor(key)}</h3><OptionalEntry kind="cosmetic" label={labelFor(key)} placeholder={`Search official ${labelFor(key).toLowerCase()} definitions…`} value={value.cosmetics[key]} onChange={(entry) => set("cosmetics", { ...value.cosmetics, [key]: entry })} /></div>)}</div>
      <h3>Ornaments</h3><NamedEntryEditor kind="cosmetic" label="Ornaments" placeholder="Search official ornament definitions…" values={value.cosmetics.ornaments} onChange={(ornaments) => set("cosmetics", { ...value.cosmetics, ornaments })} addLabel="Ornaments" requiredToggle={false} />
    </EditorSection>

    <EditorSection title="Versioning" eyebrow="Patch and changelog" icon={<CalendarClock />}>
      <div className={styles.formGrid}><label><span>Patch / episode</span><input value={value.patch || ""} onChange={(event) => set("patch", event.target.value || undefined)} /></label><label className={styles.checkField}><input type="checkbox" checked={value.outdated} onChange={(event) => set("outdated", event.target.checked)} /><span>Mark this build outdated</span></label></div>
      <div className={styles.repeater}>{value.changelog.map((entry, index) => <div className={styles.repeaterRow} key={index}><label><span>Version</span><input value={entry.version || ""} onChange={(event) => set("changelog", value.changelog.map((item, itemIndex) => itemIndex === index ? { ...item, version: event.target.value || undefined } : item))} /></label><label><span>Date</span><input type="date" value={entry.date.slice(0, 10)} onChange={(event) => set("changelog", value.changelog.map((item, itemIndex) => itemIndex === index ? { ...item, date: new Date(`${event.target.value}T00:00:00.000Z`).toISOString() } : item))} /></label><label className={styles.wideField}><span>Changes</span><input value={entry.notes} onChange={(event) => set("changelog", value.changelog.map((item, itemIndex) => itemIndex === index ? { ...item, notes: event.target.value } : item))} /></label><button type="button" className={styles.removeField} onClick={() => set("changelog", value.changelog.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div>)}<button type="button" className={styles.addField} onClick={() => set("changelog", [...value.changelog, { date: new Date().toISOString(), notes: "" }])}><CirclePlus /> Add changelog entry</button></div>
    </EditorSection>
  </>;
}

function OptionalEntry({ value, onChange, kind, label, placeholder, context }: { value?: BuildNamedEntry; onChange: (value?: BuildNamedEntry) => void; kind: BuildCatalogKind; label: string; placeholder: string; context?: { classType?: BuildDocument["classType"]; subclass?: BuildDocument["subclass"] } }) {
  return <ManifestSingleEditor value={value} onChange={onChange} kind={kind} label={label} placeholder={placeholder} context={context} />;
}

function updateArtifact(value: BuildDocument, index: number, artifact: BuildDocument["artifacts"][number], set: <K extends keyof BuildDocument>(key: K, next: BuildDocument[K]) => void): void {
  set("artifacts", value.artifacts.map((item, itemIndex) => itemIndex === index ? artifact : item));
}

function addArtifact(value: BuildDocument, entry: BuildCatalogEntry | BuildNamedEntry, set: <K extends keyof BuildDocument>(key: K, next: BuildDocument[K]) => void): void {
  const named = isCatalogEntry(entry) ? namedEntryFromCatalog(entry) : entry;
  if (value.artifacts.some((artifact) => artifact.hash && artifact.hash === named.hash || artifact.name.toLocaleLowerCase() === named.name.toLocaleLowerCase())) return;
  set("artifacts", [...value.artifacts, { ...named, tier: isCatalogEntry(entry) ? entry.itemType : undefined, perks: [] }].slice(0, 7));
}

function labelFor(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
}
