import type { BuildNamedEntry, GuardianBuild } from "@guardian-nexus/contracts";
import { AlertTriangle, ExternalLink, Footprints, Gauge, PackageOpen, Shield, Sparkles, Swords } from "lucide-react";
import { buildStatIcon } from "../../modules/builds/buildStats";
import styles from "../../pages/Builds.module.css";
import { BuildEquipmentSummary } from "./BuildEquipmentSummary";
import { BuildRichNotes } from "./BuildRichNotes";

export function BuildOverview({ build }: { build: GuardianBuild }) {
  const abilities: [string, BuildNamedEntry | undefined][] = [
    ["Super", build.subclassConfig.super], ["Class ability", build.subclassConfig.classAbility],
    ["Melee", build.subclassConfig.melee], ["Grenade", build.subclassConfig.grenade]
  ];
  const equipment = [...build.equipment.armor.filter((entry) => entry.exotic), ...build.equipment.weapons.filter((entry) => entry.exotic), ...build.equipment.weapons.filter((entry) => !entry.exotic)].slice(0, 6);
  return <div className={styles.buildOverview}>
    <OverviewSection icon={<Sparkles />} title="Subclass kit">
      <div className={styles.overviewEntries}>{abilities.filter((entry): entry is [string, BuildNamedEntry] => Boolean(entry[1])).map(([label, entry]) => <OverviewEntry key={label} label={label} entry={entry} />)}</div>
      {build.subclassConfig.aspects.length > 0 && <div className={styles.overviewChips}>{build.subclassConfig.aspects.map((entry) => <OverviewChip key={entry.hash || entry.name} entry={entry} />)}</div>}
    </OverviewSection>
    <OverviewSection icon={<Swords />} title="Core equipment">
      <div className={styles.equipmentSummaryList}>{equipment.map((entry, index) => <BuildEquipmentSummary key={`${entry.hash || entry.name}-${index}`} entry={entry} />)}</div>
    </OverviewSection>
    <OverviewSection icon={<Gauge />} title="Stat priorities">
      <div className={styles.overviewStats}>{[...build.statPriorities].sort((a, b) => a.priority - b.priority).map((stat) => <article key={stat.stat}><b>{stat.priority}</b><img src={stat.icon || buildStatIcon(stat.stat)} alt="" /><span><strong>{stat.stat}</strong><small>{stat.target ?? stat.minimum ?? stat.maximum ?? "Any target"}</small></span></article>)}</div>
    </OverviewSection>
    <OverviewSection icon={<PackageOpen />} title="Activity readiness">
      <div className={styles.overviewChips}>{build.championCounters.map((entry) => <OverviewChip key={entry.hash || entry.name} entry={entry} />)}{build.activityTags.map((tag) => <span key={tag}><Shield />{tag}</span>)}</div>
      {build.artifacts.map((artifact) => <OverviewEntry key={artifact.hash || artifact.name} label="Artifact" entry={artifact} />)}
    </OverviewSection>
    {(build.notes || build.concepts.length > 0) && <section className={styles.overviewGuide}>
      <header><Sparkles /><span><small>Creator field guide</small><h2>How the build works</h2></span></header>
      {build.concepts.length > 0 && <div className={styles.overviewChips}>{build.concepts.map((entry) => <OverviewChip key={entry.hash || entry.name} entry={entry} />)}</div>}
      {build.notes && <BuildRichNotes value={build.notes} />}
    </section>}
    {build.gameplayLoop.length > 0 && <section className={styles.overviewLoop}><header><Footprints /><h2>Gameplay loop</h2></header><ol>{build.gameplayLoop.map((step, index) => <li key={`${index}-${step.text}`}><b>{index + 1}</b><span>{step.text}</span></li>)}</ol></section>}
    <section className={styles.overviewMeta}>
      <span><strong>{build.patch || "Current field guide"}</strong><small>{build.outdated ? "Marked outdated" : `Updated ${new Date(build.updatedAt).toLocaleDateString()}`}</small></span>
      <nav>{build.links.map((link) => <a key={`${link.kind}-${link.url}`} href={link.url} target="_blank" rel="noreferrer"><ExternalLink />{link.label}</a>)}</nav>
    </section>
  </div>;
}

function OverviewSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className={styles.overviewSection}><header>{icon}<h2>{title}</h2></header><div>{children}</div></section>;
}

function OverviewEntry({ label, entry }: { label: string; entry: BuildNamedEntry }) {
  return <article className={styles.overviewEntry}>{entry.icon ? <img src={entry.icon} alt="" loading="lazy" /> : <AlertTriangle />}<span><small>{label}</small><strong>{entry.name}</strong>{entry.itemType && <em>{entry.itemType}</em>}</span></article>;
}

function OverviewChip({ entry }: { entry: BuildNamedEntry }) {
  return <span>{entry.icon ? <img src={entry.icon} alt="" /> : <AlertTriangle />}{entry.name}</span>;
}
