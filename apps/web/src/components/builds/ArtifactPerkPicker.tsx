import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import { AlertTriangle, Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { namedEntryFromCatalog, useBuildCatalog } from "../../modules/builds/buildCatalog";
import styles from "../../pages/Builds.module.css";

const TIERS = [
  { tier: 1 as const, limit: 2 },
  { tier: 2 as const, limit: 3 },
  { tier: 3 as const, limit: 2 }
];

export function ArtifactPerkPicker({ artifactHash, artifactName, values, onChange }: {
  artifactHash?: string;
  artifactName: string;
  values: BuildNamedEntry[];
  onChange: (values: BuildNamedEntry[]) => void;
}) {
  const [query, setQuery] = useState("");
  const result = useBuildCatalog({ kind: "artifactPerk", query: "", itemHash: artifactHash, itemName: artifactName, allowEmpty: true });
  const entries = result.data?.data.results || [];
  const tierByHash = useMemo(() => new Map(entries.map((entry) => [entry.hash, entry.artifactTier])), [entries]);
  const selectedTier = (entry: BuildNamedEntry) => entry.artifactTier || (entry.hash ? tierByHash.get(entry.hash) : undefined);
  const isSelected = (hash: string) => values.some((entry) => entry.hash === hash);
  const filter = query.trim().toLocaleLowerCase();

  const toggle = (hash: string) => {
    const entry = entries.find((candidate) => candidate.hash === hash);
    if (!entry?.artifactTier) return;
    if (isSelected(hash)) return onChange(values.filter((value) => value.hash !== hash));
    const limit = TIERS.find((value) => value.tier === entry.artifactTier)?.limit || 0;
    if (values.filter((value) => selectedTier(value) === entry.artifactTier).length >= limit) return;
    onChange([...values, namedEntryFromCatalog(entry)].slice(0, 7));
  };

  return <div className={styles.artifactPerkPicker}>
    <header className={styles.artifactPickerHeader}>
      <span><strong>Artifact 2.0 perk slots</strong><small>Choose 2 Tier 1, 3 Tier 2, and 2 Tier 3 perks</small></span>
      <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this Artifact's perks" /></label>
    </header>
    {result.isLoading && <p className={styles.artifactPickerStatus}>Reading current Artifact slots from the Bungie manifest…</p>}
    {result.error && <p className={styles.artifactPickerStatus}><AlertTriangle /> Artifact perk data is temporarily unavailable.</p>}
    {!result.isLoading && !result.error && <div className={styles.artifactTiers}>
      {TIERS.map(({ tier, limit }) => {
        const selectedCount = values.filter((value) => selectedTier(value) === tier).length;
        const tierEntries = entries.filter((entry) => entry.artifactTier === tier && (!filter || `${entry.name} ${entry.description}`.toLocaleLowerCase().includes(filter)));
        return <section key={tier} className={styles.artifactTier} data-tier={tier}>
          <header><span><b>{tier}</b><strong>Tier {tier}</strong></span><span className={styles.artifactSlotPips} aria-label={`${selectedCount} of ${limit} slots selected`}>{Array.from({ length: limit }, (_, index) => <i key={index} data-filled={index < selectedCount} />)}<em>{selectedCount}/{limit}</em></span></header>
          <div>{tierEntries.map((entry) => {
            const selected = isSelected(entry.hash);
            return <button type="button" key={entry.hash} data-selected={selected} disabled={selectedCount >= limit && !selected} onClick={() => toggle(entry.hash)} title={`${entry.name}\n${entry.description}`} aria-pressed={selected}>
              <span className={styles.artifactPerkIcon}><img src={entry.icon} alt="" loading="lazy" />{selected && <i><Check /></i>}</span>
              <span><strong>{entry.name}</strong><small>{entry.description}</small></span>
            </button>;
          })}</div>
          {!tierEntries.length && <p>No Tier {tier} perks match this filter.</p>}
        </section>;
      })}
    </div>}
    {values.some((value) => !selectedTier(value)) && <p className={styles.artifactLegacyNotice}><AlertTriangle /> A legacy saved perk does not belong to this Artifact's current tiers. Remove it before filling all seven slots.</p>}
  </div>;
}
