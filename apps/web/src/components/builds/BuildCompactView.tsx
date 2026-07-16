import type { BuildArmorMods, BuildEquipmentEntry, BuildNamedEntry, GuardianBuild } from "@guardian-nexus/contracts";
import { CircleHelp, Footprints, Gauge, MessageSquareText, PackageOpen, Sparkles, Swords } from "lucide-react";
import { buildStatIcon } from "../../modules/builds/buildStats";
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
  return <div className={styles.compactBuild}>
    <CompactSection title="Subclass & abilities" icon={<Sparkles />}>
      <IconRail>{abilities.map(([label, entry]) => <BuildIconTooltip key={label} entry={entry} label={label} />)}</IconRail>
      <CompactSubgroup label="Aspects"><IconRail>{build.subclassConfig.aspects.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${index}`} entry={entry} label="Aspect" />)}</IconRail></CompactSubgroup>
      <CompactSubgroup label="Fragments"><IconRail>{build.subclassConfig.fragments.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${index}`} entry={entry} label="Fragment" />)}</IconRail></CompactSubgroup>
    </CompactSection>

    <CompactSection title="Weapons & armor" icon={<Swords />}>
      <CompactSubgroup label="Weapons"><IconRail>{build.equipment.weapons.map((entry, index) => <EquipmentIcon key={`${entry.hash}-${index}`} entry={entry} label={entry.slot || "Weapon"} />)}</IconRail></CompactSubgroup>
      <CompactSubgroup label="Armor"><IconRail>{build.equipment.armor.map((entry, index) => <EquipmentIcon key={`${entry.hash}-${index}`} entry={entry} label={entry.slot || "Armor"} />)}</IconRail></CompactSubgroup>
      <CompactSubgroup label="Set bonuses"><IconRail>{build.equipment.armorSets.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${entry.requiredPieces}-${index}`} entry={entry} label={entry.requiredPieces === 4 ? "2 + 4-piece set" : "2-piece set"} related={entry.bonuses || []} badge={entry.requiredPieces === 4 ? "2+4" : "2"} />)}</IconRail></CompactSubgroup>
    </CompactSection>

    <CompactSection title="Stats & armor mods" icon={<Gauge />}>
      <CompactSubgroup label="Priority"><IconRail>{[...build.statPriorities].sort((a, b) => a.priority - b.priority).map((stat) => {
        const value = stat.target ?? stat.minimum ?? stat.maximum;
        return <BuildIconTooltip key={stat.stat} entry={{ name: value === undefined ? "Any" : `${stat.stat} ${value}`, icon: stat.icon || buildStatIcon(stat.stat), itemType: `Priority ${stat.priority}`, description: statDescription(stat) }} label={stat.stat} badge={value === undefined ? "∞" : String(value)} />;
      })}</IconRail></CompactSubgroup>
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

function slotLabel(slot: keyof BuildArmorMods): string { return slot === "classItem" ? "Class item" : slot[0]!.toUpperCase() + slot.slice(1); }

function statDescription(stat: GuardianBuild["statPriorities"][number]): string {
  if (stat.minimum === undefined && stat.target === undefined && stat.maximum === undefined) return "Any value is acceptable for this stat.";
  return [stat.minimum !== undefined && `Minimum ${stat.minimum}`, stat.target !== undefined && `Target ${stat.target}`, stat.maximum !== undefined && `Maximum ${stat.maximum}`].filter(Boolean).join(" · ");
}
