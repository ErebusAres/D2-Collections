import type { BuildArmorMods, BuildEquipmentEntry, BuildNamedEntry, GuardianBuild } from "@guardian-nexus/contracts";
import { CircleHelp, Footprints, Gauge, MessageSquareText, PackageOpen, Sparkles, Swords } from "lucide-react";
import { buildStatIcon } from "../../modules/builds/buildStats";
import { normalizeArmorSetSelections } from "../../modules/builds/armorSetBonuses";
import styles from "../../pages/Builds.module.css";
import { expandBuildEntries } from "./BuildFormControls";
import { BuildIconTooltip } from "./BuildIconTooltip";
import { BuildRichNotes } from "./BuildRichNotes";

export function BuildCompactView({ build }: { build: GuardianBuild }) {
  const abilities: [string, BuildNamedEntry | undefined][] = [
    ["Subclass", { name: build.subclass, icon: build.subclassIcon, itemType: `${build.classType} subclass` }],
    ["Super", build.subclassConfig.super], ["Class ability", build.subclassConfig.classAbility], ["Movement", build.subclassConfig.movement],
    ["Melee", build.subclassConfig.melee], ["Grenade", build.subclassConfig.grenade]
  ];
  const modGroups = Object.entries(build.armorMods) as [keyof BuildArmorMods, BuildNamedEntry[]][];
  const armorSets = normalizeArmorSetSelections(build.equipment.armorSets);
  return <div className={styles.compactBuild}>
    <CompactSection title="Subclass & abilities" icon={<Sparkles />}>
      <IconRail>{abilities.map(([label, entry]) => <BuildIconTooltip key={label} entry={entry} label={label} />)}</IconRail>
      <CompactSubgroup label="Aspects"><IconRail>{build.subclassConfig.aspects.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${index}`} entry={entry} label="Aspect" />)}</IconRail></CompactSubgroup>
      <CompactSubgroup label="Fragments"><IconRail>{build.subclassConfig.fragments.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${index}`} entry={entry} label="Fragment" />)}</IconRail></CompactSubgroup>
    </CompactSection>

    <CompactSection title="Weapons & armor" icon={<Swords />}>
      <CompactSubgroup label="Weapons"><IconRail>{build.equipment.weapons.map((entry, index) => <EquipmentIcon key={`${entry.hash}-${index}`} entry={entry} label={entry.slot || "Weapon"} />)}</IconRail></CompactSubgroup>
      <CompactSubgroup label="Armor"><IconRail>{build.equipment.armor.map((entry, index) => <EquipmentIcon key={`${entry.hash}-${index}`} entry={entry} label={entry.slot || "Armor"} />)}</IconRail></CompactSubgroup>
      <CompactSubgroup label="Selected set bonuses"><IconRail>{armorSets.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${entry.requiredPieces}-${index}`} entry={entry} label={`${entry.setName || "Armor set"} · ${entry.requiredPieces}-piece bonus`} badge={String(entry.requiredPieces || "?")} />)}</IconRail></CompactSubgroup>
    </CompactSection>

    <CompactSection title="Stats & armor mods" icon={<Gauge />}>
      <CompactSubgroup label="Priority scale · 1 highest → 6 lowest"><div className={styles.compactStatPriorities}>{[...build.statPriorities].sort((a, b) => a.priority - b.priority).map((stat) => <StatPriority key={stat.stat} stat={stat} />)}</div></CompactSubgroup>
      <div className={styles.compactModGroups}>{modGroups.map(([slot, entries]) => entries.length > 0 && <CompactSubgroup key={slot} label={slotLabel(slot)}><IconRail>{expandBuildEntries(entries).map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${index}`} entry={entry} label={`${slotLabel(slot)} socket ${index + 1}`} />)}</IconRail></CompactSubgroup>)}</div>
    </CompactSection>

    <CompactSection title="Artifact & counters" icon={<PackageOpen />}>
      {build.artifacts.map((artifact, index) => <CompactSubgroup key={`${artifact.hash}-${index}`} label={artifact.name}><IconRail><BuildIconTooltip entry={artifact} label="Artifact" />{artifact.perks.map((entry, perkIndex) => <BuildIconTooltip key={`${entry.hash}-${perkIndex}`} entry={entry} label="Equipped Artifact perk" />)}</IconRail></CompactSubgroup>)}
      <CompactSubgroup label="Champion counters"><IconRail>{build.championCounters.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${index}`} entry={entry} label="Champion counter" />)}</IconRail></CompactSubgroup>
    </CompactSection>

    <section className={styles.compactFieldGuide}>
      <article><header><MessageSquareText /><span><small>Creator field guide</small><strong>Notes & build concepts</strong></span></header>{build.concepts.length > 0 && <IconRail>{build.concepts.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${index}`} entry={entry} label="Build concept" />)}</IconRail>}{build.notes ? <BuildRichNotes value={build.notes} /> : <p className={styles.compactEmpty}><CircleHelp /> No notes have been added.</p>}</article>
      <article><header><Footprints /><span><small>Combat rotation</small><strong>Gameplay loop</strong></span></header>{build.gameplayLoop.length ? <ol>{build.gameplayLoop.map((step, index) => <li key={`${index}-${step.text}`}><b>{index + 1}</b><span>{step.text}</span></li>)}</ol> : <p className={styles.compactEmpty}><CircleHelp /> No gameplay loop has been added.</p>}</article>
    </section>
  </div>;
}

function CompactSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className={styles.compactSection}><header>{icon}<h2>{title}</h2></header><div>{children}</div></section>;
}

function CompactSubgroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className={styles.compactSubgroup}><small>{label}</small>{children}</div>;
}

function IconRail({ children }: { children: React.ReactNode }) {
  return <div className={styles.buildIconRail}>{children}</div>;
}

function EquipmentIcon({ entry, label }: { entry: BuildEquipmentEntry; label: string }) {
  return <BuildIconTooltip entry={entry} label={label} related={[...(entry.traits || []), ...(entry.selectedPerks || []), ...(entry.selectedSpirits || [])]} badge={entry.exotic ? "★" : undefined} />;
}

function StatPriority({ stat }: { stat: GuardianBuild["statPriorities"][number] }) {
  const value = stat.target ?? stat.minimum ?? stat.maximum;
  const priorityLabel = stat.priority === 1 ? "Highest" : stat.priority === 6 ? "Lowest" : "Priority";
  return <article className={styles.compactStatPriority} data-priority={stat.priority} aria-label={`${stat.stat}, priority ${stat.priority} of 6, ${value === undefined ? "any value" : `value ${value}`}`}>
    <span className={styles.compactStatRank}><small>Priority</small><b>{stat.priority}</b><em>of 6</em></span>
    <BuildIconTooltip entry={{ name: stat.stat, icon: stat.icon || buildStatIcon(stat.stat), itemType: `Priority ${stat.priority} of 6 · ${priorityLabel}`, description: statDescription(stat) }} label={`${stat.stat} stat`} />
    <span className={styles.compactStatValue}><strong>{stat.stat}</strong><b>{value === undefined ? "Any" : value}</b><small>{priorityLabel}</small></span>
  </article>;
}

function slotLabel(slot: keyof BuildArmorMods): string { return slot === "classItem" ? "Class item" : slot[0]!.toUpperCase() + slot.slice(1); }

function statDescription(stat: GuardianBuild["statPriorities"][number]): string {
  if (stat.minimum === undefined && stat.target === undefined && stat.maximum === undefined) return "Any value is acceptable for this stat.";
  return [stat.minimum !== undefined && `Minimum ${stat.minimum}`, stat.target !== undefined && `Target ${stat.target}`, stat.maximum !== undefined && `Maximum ${stat.maximum}`].filter(Boolean).join(" · ");
}
