import type { BuildArmorMods, BuildNamedEntry, GuardianBuild } from "@guardian-nexus/contracts";
import { AlertTriangle, CircleHelp, ExternalLink, Film, Footprints, Gauge, Link2, MessageSquareText, PackageOpen, Palette, Play, Puzzle, Sparkles, Swords } from "lucide-react";
import type { ReactNode } from "react";
import { buildStatIcon } from "../../modules/builds/buildStats";
import { normalizeArmorSetSelections } from "../../modules/builds/armorSetBonuses";
import { expandBuildEntries } from "./BuildFormControls";
import { BuildRichNotes } from "./BuildRichNotes";
import styles from "../../pages/Builds.module.css";

export function BuildDetailSections({ build }: { build: GuardianBuild }) {
  const mediaLinks = build.links.filter((link) => ["youtube", "twitch", "source", "other", "dim", "mobalytics"].includes(link.kind));
  return <div className={styles.detailSections}>
    <BuildSection id="links" eyebrow="Sources and tools" title="Media & external links" icon={<Film />} empty={!mediaLinks.length}>
      <div className={styles.linkGrid}>{mediaLinks.map((link) => <a key={`${link.kind}-${link.url}`} href={link.url} target="_blank" rel="noreferrer"><i>{link.kind === "youtube" || link.kind === "twitch" ? <Play /> : <ExternalLink />}</i><span>{link.kind}</span><strong>{link.label}</strong><small>{safeHost(link.url)}</small></a>)}</div>
    </BuildSection>

    <BuildSection id="notes" eyebrow="Creator field notes" title="Notes" icon={<MessageSquareText />} empty={!build.notes && !build.concepts.length}>
      {build.concepts.length > 0 && <NamedGroup title="At a glance" entries={build.concepts} />}
      {build.notes && <BuildRichNotes value={build.notes} />}
    </BuildSection>

    <BuildSection id="subclass" eyebrow="Ability configuration" title="Subclass" icon={<Sparkles />} empty={!hasSubclassData(build)}>
      <EntryGrid entries={[
        ["Super", build.subclassConfig.super],
        ["Class ability", build.subclassConfig.classAbility],
        ["Movement", build.subclassConfig.movement],
        ["Melee", build.subclassConfig.melee],
        ["Grenade", build.subclassConfig.grenade]
      ]} />
      <NamedGroup title="Aspects" entries={build.subclassConfig.aspects} />
      <NamedGroup title="Fragments" entries={build.subclassConfig.fragments} />
      {build.subclassConfig.notes && <p className={styles.sectionNotes}>{build.subclassConfig.notes}</p>}
    </BuildSection>

    <BuildSection id="gear" eyebrow="Saved equipment" title="Equipment" icon={<Swords />} empty={!build.equipment.weapons.length && !build.equipment.armor.length && !build.equipment.armorSets.length}>
      <EquipmentGroup title="Weapons" entries={build.equipment.weapons} />
      <EquipmentGroup title="Armor" entries={build.equipment.armor} />
      <ArmorSetBonusGroup entries={build.equipment.armorSets} />
    </BuildSection>

    <BuildSection id="stats" eyebrow="Target thresholds" title="Stat priorities" icon={<Gauge />} empty={!build.statPriorities.length}>
      <div className={styles.statStrip}>{[...build.statPriorities].sort((a, b) => a.priority - b.priority).map((stat) => <article key={`${stat.priority}-${stat.stat}`} data-priority={stat.priority}><i><b>{stat.priority}</b><small>of 6</small></i><img src={stat.icon || buildStatIcon(stat.stat)} alt="" /><span><small>{stat.priority === 1 ? "Highest priority" : stat.priority === 6 ? "Lowest priority" : `Priority ${stat.priority}`}</small><strong>{stat.stat}</strong></span><b>{stat.target ?? stat.minimum ?? stat.maximum ?? "Any"}</b><small>{stat.minimum === undefined && stat.target === undefined && stat.maximum === undefined ? "Any value · no fixed threshold" : <>{stat.minimum !== undefined && `Min ${stat.minimum}`}{stat.minimum !== undefined && stat.target !== undefined && " · "}{stat.target !== undefined && `Target ${stat.target}`}{stat.maximum !== undefined && ` · Max ${stat.maximum}`}</>}</small></article>)}</div>
    </BuildSection>

    <BuildSection id="mods" eyebrow="Armor energy" title="Armor mods" icon={<Puzzle />} empty={!Object.values(build.armorMods).some((entries) => entries.length)}>
      <div className={styles.modColumns}>{(Object.entries(build.armorMods) as [keyof BuildArmorMods, BuildNamedEntry[]][]).map(([slot, entries]) => entries.length > 0 && <NamedGroup key={slot} title={armorSlotLabel(slot)} entries={expandBuildEntries(entries)} />)}</div>
    </BuildSection>

    <BuildSection id="artifact" eyebrow="Seasonal configuration" title="Artifact" icon={<PackageOpen />} empty={!build.artifacts.length && !build.championCounters.length}>
      <div className={styles.artifactGrid}>{build.artifacts.map((artifact) => <article key={artifact.name}><header>{artifact.icon ? <img src={artifact.icon} alt="" /> : <span className={styles.unavailableManifestIcon} title="Official Artifact icon unavailable"><AlertTriangle /></span>}<span><small>{artifact.tier || "Artifact / tablet"}</small><strong>{artifact.name}</strong></span></header>{artifact.notes && <p>{artifact.notes}</p>}<NamedGroup title="Selected perks" entries={artifact.perks} /></article>)}</div>
      <NamedGroup title="Champion counters" entries={build.championCounters} />
    </BuildSection>

    <BuildSection id="loop" eyebrow="Combat rotation" title="Gameplay loop" icon={<Footprints />} empty={!build.gameplayLoop.length}>
      <ol className={styles.gameplayLoop}>{build.gameplayLoop.map((step, index) => <li key={`${index}-${step.text}`}><i>{step.icon ? <img src={step.icon} alt="" /> : index + 1}</i><span>{step.text}</span></li>)}</ol>
    </BuildSection>

    <BuildSection id="cosmetics" eyebrow="Guardian presentation" title="Cosmetics" icon={<Palette />} empty={!hasCosmetics(build)}>
      <NamedGroup title="Style" entries={[build.cosmetics.shader, ...build.cosmetics.ornaments, build.cosmetics.ghost, build.cosmetics.sparrow, build.cosmetics.ship].filter((entry): entry is BuildNamedEntry => Boolean(entry))} />
      {build.cosmetics.notes && <p className={styles.sectionNotes}>{build.cosmetics.notes}</p>}
    </BuildSection>

    <BuildSection id="changelog" eyebrow="Build history" title="Version & changelog" icon={<Link2 />} empty={!build.patch && !build.changelog.length}>
      <div className={styles.changelog}>{build.patch && <article><strong>{build.patch}</strong><span>{build.outdated ? "Marked outdated" : "Current build version"}</span></article>}{build.changelog.map((entry, index) => <article key={`${entry.date}-${index}`}><strong>{entry.version || new Date(entry.date).toLocaleDateString()}</strong><span>{entry.notes}</span><time>{new Date(entry.date).toLocaleDateString()}</time></article>)}</div>
    </BuildSection>
  </div>;
}

function BuildSection({ id, eyebrow, title, icon, empty, children }: { id: string; eyebrow: string; title: string; icon: ReactNode; empty: boolean; children: ReactNode }) {
  return <section id={id} className={styles.buildSection}><header><i>{icon}</i><div><span>{eyebrow}</span><h2>{title}</h2></div></header>{empty ? <div className={styles.sectionEmpty}><CircleHelp /> No information has been added for this section.</div> : children}</section>;
}

function EntryGrid({ entries }: { entries: [string, BuildNamedEntry | undefined][] }) {
  const available = entries.filter((entry): entry is [string, BuildNamedEntry] => Boolean(entry[1]));
  if (!available.length) return null;
  return <div className={styles.entryGrid}>{available.map(([label, entry]) => <NamedEntry key={label} label={label} entry={entry} />)}</div>;
}

function NamedGroup({ title, entries }: { title: string; entries: BuildNamedEntry[] }) {
  if (!entries.length) return null;
  return <div className={styles.namedGroup}><h3>{title}</h3><div>{entries.map((entry, index) => <NamedEntry key={`${entry.name}-${index}`} entry={entry} />)}</div></div>;
}

function NamedEntry({ label, entry }: { label?: string; entry: BuildNamedEntry }) {
  return <article className={styles.namedEntry}>{entry.icon ? <img src={entry.icon} alt="" loading="lazy" /> : <span className={styles.unavailableManifestIcon} title="Official icon unavailable"><AlertTriangle /></span>}<span>{(label || entry.itemType || entry.damageType) && <small>{[label || entry.itemType, label ? entry.itemType : undefined, entry.damageType].filter(Boolean).join(" · ")}</small>}<strong>{entry.name}</strong>{entry.description && <p>{entry.description}</p>}{entry.notes && <p>{entry.notes}</p>}</span>{(entry.quantity || 1) > 1 ? <em data-required="true">×{entry.quantity}</em> : entry.required !== undefined && <em data-required={entry.required}>{entry.required ? "Required" : "Flexible"}</em>}</article>;
}

function EquipmentGroup({ title, entries }: { title: string; entries: GuardianBuild["equipment"]["weapons"] }) {
  if (!entries.length) return null;
  return <div className={styles.namedGroup}><h3>{title}</h3><div>{entries.map((entry, index) => <article className={`${styles.namedEntry} ${styles.equipmentDetailEntry}`} key={`${entry.slot}-${entry.name}-${index}`}>{entry.icon ? <img src={entry.icon} alt="" loading="lazy" /> : <span className={styles.unavailableManifestIcon} title="Official item icon unavailable"><AlertTriangle /></span>}<span><small>{[entry.slot, entry.itemType, entry.damageType].filter(Boolean).join(" · ")}</small><strong>{entry.name}</strong>{entry.perks && <p>{entry.perks}</p>}{entry.notes && <p>{entry.notes}</p>}</span>{entry.exotic ? <em data-required="true">Exotic</em> : entry.required !== undefined && <em data-required={entry.required}>{entry.required ? "Required" : "Flexible"}</em>}{[...(entry.traits || []), ...(entry.selectedPerks || []), ...(entry.selectedSpirits || [])].length ? <div className={styles.equipmentRoll}>{[...(entry.traits || []), ...(entry.selectedPerks || []), ...(entry.selectedSpirits || [])].map((perk, perkIndex) => <span key={`${perk.hash}-${perk.name}-${perkIndex}`} title={perk.description || perk.name}>{perk.icon ? <img src={perk.icon} alt="" /> : <AlertTriangle />}<small>{perk.row ? `Spirit row ${perk.row}` : perk.itemType}</small><strong>{perk.name}</strong></span>)}</div> : null}</article>)}</div></div>;
}

function ArmorSetBonusGroup({ entries }: { entries: BuildNamedEntry[] }) {
  const selected = normalizeArmorSetSelections(entries);
  if (!selected.length) return null;
  return <div className={styles.armorSetBonuses}><h3>Selected set bonuses</h3>{selected.map((entry, index) => <article key={`${entry.hash}-${entry.requiredPieces}-${index}`}><header>{entry.icon ? <img src={entry.icon} alt="" /> : <AlertTriangle />}<span><small>{entry.requiredPieces}-piece bonus selected</small><strong>{entry.setName || entry.name}</strong></span></header><div>{(entry.bonuses?.length ? entry.bonuses : [entry]).map((bonus) => <NamedEntry key={`${bonus.hash}-${bonus.requiredPieces}-${bonus.name}`} entry={bonus} />)}</div></article>)}</div>;
}

function hasSubclassData(build: GuardianBuild): boolean {
  const value = build.subclassConfig;
  return Boolean(value.super || value.classAbility || value.movement || value.melee || value.grenade || value.aspects.length || value.fragments.length || value.notes);
}

function hasCosmetics(build: GuardianBuild): boolean {
  const value = build.cosmetics;
  return Boolean(value.shader || value.ornaments.length || value.ghost || value.sparrow || value.ship || value.notes);
}

function armorSlotLabel(slot: keyof BuildArmorMods): string {
  return slot === "classItem" ? "Class item" : slot[0]!.toUpperCase() + slot.slice(1);
}

function safeHost(value: string): string {
  try { return new URL(value).hostname; } catch { return "External link"; }
}
