import type { BuildEquipmentEntry, BuildNamedEntry } from "@guardian-nexus/contracts";
import styles from "../../pages/Builds.module.css";
import { BuildIconTooltip } from "./BuildIconTooltip";

type EquipmentGroup = { label: string; entries: BuildNamedEntry[] };

export function BuildEquipmentSummary({ entry }: { entry: BuildEquipmentEntry }) {
  const groups = equipmentGroups(entry);
  return <article className={styles.equipmentSummary}>
    <header>
      <BuildIconTooltip entry={entry} label={entry.slot || "Equipment"} />
      <span>
        <small>{[entry.slot, entry.itemType, entry.damageType].filter(Boolean).join(" · ")}</small>
        <strong>{entry.name}</strong>
        {entry.required && <em>Required</em>}
        {groups.length > 0 && <div className={styles.equipmentPerkGroups}>
          {groups.map((group) => <section key={group.label}>
            <small>{group.label}</small>
            <div>{group.entries.map((perk, index) => <span className={styles.equipmentPerkToken} key={`${perk.hash || perk.name}-${index}`}>
              <BuildIconTooltip entry={perk} label={perk.row ? `Spirit row ${perk.row}` : group.label} />
            </span>)}</div>
          </section>)}
        </div>}
      </span>
      {entry.exotic && <b>Exotic</b>}
    </header>
  </article>;
}

export function equipmentGroups(entry: BuildEquipmentEntry): EquipmentGroup[] {
  const groups: EquipmentGroup[] = [];
  if (entry.traits?.length) groups.push({ label: "Inherent perks", entries: entry.traits });
  groups.push(...groupSelectedPerks(entry.selectedPerks || []));
  const spirits = [...(entry.selectedSpirits || [])].sort((a, b) => (a.row || 0) - (b.row || 0));
  if (spirits.length) groups.push({ label: "Exotic Spirits", entries: spirits });
  return groups;
}

function groupSelectedPerks(entries: BuildNamedEntry[]): EquipmentGroup[] {
  const groups = new Map<string, BuildNamedEntry[]>();
  for (const entry of entries) {
    const raw = entry.itemType?.trim();
    const label = raw && !/^(common|uncommon|rare|legendary|exotic)$/i.test(raw) ? raw : "Selected perks";
    const current = groups.get(label) || [];
    current.push(entry);
    groups.set(label, current);
  }
  return [...groups].map(([label, groupedEntries]) => ({ label, entries: groupedEntries }));
}
