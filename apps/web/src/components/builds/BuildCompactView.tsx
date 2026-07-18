import type { BuildArmorMods, BuildNamedEntry, GuardianBuild } from "@guardian-nexus/contracts";
import { CircleHelp, Footprints, Gauge, MessageSquareText, PackageOpen, Sparkles, Swords } from "lucide-react";
import { buildStatIcon, buildStatValueLabels } from "../../modules/builds/buildStats";
import { normalizeArmorSetSelections } from "@guardian-nexus/domain";
import styles from "../../pages/Builds.module.css";
import { expandBuildEntries } from "./BuildFormControls";
import { BuildIconTooltip } from "./BuildIconTooltip";
import { BuildRichNotes } from "./BuildRichNotes";
import { BuildEquipmentSummary } from "./BuildEquipmentSummary";
import { useBuildTranscendence } from "../../modules/builds/buildCatalog";

export function BuildCompactView({ build }: { build: GuardianBuild }) {
  const transcendence = useBuildTranscendence(build.classType, build.subclass, build.subclassConfig.transcendence);
  const abilities: [string, BuildNamedEntry | undefined][] = [
    ["Subclass", { name: build.subclass, icon: build.subclassIcon, itemType: `${build.classType} subclass` }],
    ["Super", build.subclassConfig.super], ...(build.subclass === "prismatic" ? [["Transcendence", transcendence] as [string, BuildNamedEntry | undefined]] : []), ["Class ability", build.subclassConfig.classAbility],
    ["Movement", build.subclassConfig.movement], ["Melee", build.subclassConfig.melee], ["Grenade", build.subclassConfig.grenade]
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
      <CompactSubgroup label="Weapons"><div className={styles.equipmentSummaryList}>{build.equipment.weapons.map((entry, index) => <BuildEquipmentSummary key={`${entry.hash}-${index}`} entry={entry} />)}</div></CompactSubgroup>
      <div className={styles.compactArmorRow}>
        <CompactSubgroup label="Exotic armor & key pieces"><div className={styles.equipmentSummaryList}>{build.equipment.armor.map((entry, index) => <BuildEquipmentSummary key={`${entry.hash}-${index}`} entry={entry} />)}</div></CompactSubgroup>
        <CompactSubgroup label="Selected set bonuses"><div className={styles.armorSetIconRail}><IconRail>{armorSets.map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${entry.requiredPieces}-${index}`} entry={entry} label={`${entry.setName || "Armor set"} · ${entry.requiredPieces}-piece bonus`} />)}</IconRail></div></CompactSubgroup>
      </div>
    </CompactSection>

    <CompactSection title="Stats & armor mods" icon={<Gauge />}>
      <CompactSubgroup label="Stat investment · highest priority → most flexible"><StatPriorityPath stats={build.statPriorities} /></CompactSubgroup>
      <div className={styles.compactModGroups}>{modGroups.map(([slot, entries]) => entries.length > 0 && <CompactSubgroup key={slot} label={slotLabel(slot)}><IconRail>{expandBuildEntries(entries).map((entry, index) => <BuildIconTooltip key={`${entry.hash}-${index}`} entry={entry} label={`${slotLabel(slot)} socket ${index + 1}`} />)}</IconRail></CompactSubgroup>)}</div>
    </CompactSection>

    <CompactSection title="Artifact" icon={<PackageOpen />}>
      {build.artifacts.map((artifact, index) => <CompactSubgroup key={`${artifact.hash}-${index}`} label={artifact.name}><IconRail><BuildIconTooltip entry={artifact} label="Artifact" />{artifact.perks.map((entry, perkIndex) => <BuildIconTooltip key={`${entry.hash}-${perkIndex}`} entry={entry} label="Equipped Artifact perk" />)}</IconRail></CompactSubgroup>)}
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

function StatPriorityPath({ stats }: { stats: GuardianBuild["statPriorities"] }) {
  const ordered = [...stats].sort((a, b) => a.priority - b.priority);
  return <div className={styles.statPriorityPath} style={{ "--stat-count": Math.max(ordered.length, 1) } as React.CSSProperties}>
    {ordered.map((stat, index) => <StatPriority key={stat.stat} stat={stat} index={index} total={ordered.length} />)}
  </div>;
}

function StatPriority({ stat, index, total }: { stat: GuardianBuild["statPriorities"][number]; index: number; total: number }) {
  const values = buildStatValueLabels(stat);
  const position = statInvestmentLabel(index, total);
  return <article className={styles.statPriorityNode} data-primary={index === 0} style={statGlowStyle(stat)} aria-label={`${stat.stat}, ${position}, ${values.map((value) => value.text).join(", ")}`}>
    <BuildIconTooltip entry={{ name: stat.stat, icon: stat.icon || buildStatIcon(stat.stat), itemType: position, description: statDescription(stat) }} label={`${stat.stat} stat`} />
    <span className={styles.statPriorityIdentity}><strong>{stat.stat}</strong><small>{index === 0 ? "Focus first" : index === total - 1 ? "Flexible" : "Then invest"}</small></span>
    <span className={styles.statPriorityValues}>{values.map((value) => <b key={value.text} data-target={value.target}>{value.text}</b>)}</span>
  </article>;
}

function slotLabel(slot: keyof BuildArmorMods): string { return slot === "classItem" ? "Class item" : slot[0]!.toUpperCase() + slot.slice(1); }

function statDescription(stat: GuardianBuild["statPriorities"][number]): string {
  if (stat.minimum === undefined && stat.target === undefined && stat.maximum === undefined) return "Any value is acceptable for this stat.";
  return [stat.minimum !== undefined && `Minimum ${stat.minimum}`, stat.target !== undefined && `Target ${stat.target}`, stat.maximum !== undefined && `Maximum ${stat.maximum}`].filter(Boolean).join(" · ");
}

function statInvestmentLabel(index: number, total: number): string {
  if (index === 0) return "highest priority";
  if (index === total - 1) return "most flexible";
  const progress = index / Math.max(total - 1, 1);
  if (progress <= .25) return "strong investment";
  if (progress <= .5) return "moderate investment";
  if (progress <= .75) return "supporting investment";
  return "lower investment";
}

function statGlowStyle(stat: GuardianBuild["statPriorities"][number]): React.CSSProperties {
  const value = stat.target ?? stat.maximum ?? stat.minimum ?? 0;
  const strength = Math.max(0, Math.min(1, value / 200));
  return {
    "--stat-border-alpha": (.18 + strength * .62).toFixed(3),
    "--stat-glow-alpha": (.015 + strength * .18).toFixed(3),
    "--stat-glow-radius": `${(2 + strength * 8).toFixed(1)}px`,
    "--stat-icon-glow-alpha": (.04 + strength * .24).toFixed(3),
    "--stat-icon-glow-radius": `${(2 + strength * 4).toFixed(1)}px`
  } as React.CSSProperties;
}
