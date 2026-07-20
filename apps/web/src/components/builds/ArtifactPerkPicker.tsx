import type { BuildNamedEntry } from "@guardian-nexus/contracts";
import { AlertTriangle, Check, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ARTIFACT_SLOT_ACCESS, artifactPerkIdentity, resolveArtifactPerkSlots, serializeArtifactPerkSlots } from "../../modules/builds/artifactSlots";
import { namedEntryFromCatalog, useBuildCatalog } from "../../modules/builds/buildCatalog";
import styles from "../../pages/Builds.module.css";

export function ArtifactPerkPicker({ artifactHash, artifactName, values, onChange }: {
  artifactHash?: string;
  artifactName: string;
  values: BuildNamedEntry[];
  onChange: (values: BuildNamedEntry[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeSlot, setActiveSlot] = useState(1);
  const result = useBuildCatalog({ kind: "artifactPerk", query: "", itemHash: artifactHash, itemName: artifactName, allowEmpty: true });
  const entries = result.data?.data.results || [];
  const slots = useMemo(() => resolveArtifactPerkSlots(values, entries), [entries, values]);
  const selected = slots[activeSlot - 1]?.perk;
  const maxTier = ARTIFACT_SLOT_ACCESS[activeSlot - 1] || 1;
  const filter = query.trim().toLocaleLowerCase();
  const selectedIdentities = new Set(slots.flatMap((slot) => slot.perk ? [artifactPerkIdentity(slot.perk)] : []));
  const eligible = entries.filter((entry) => {
    if (!entry.artifactTier || entry.artifactTier > maxTier) return false;
    const matches = !filter || `${entry.name} ${entry.description}`.toLocaleLowerCase().includes(filter);
    const identity = artifactPerkIdentity(entry);
    return matches && (!selectedIdentities.has(identity) || identity === (selected ? artifactPerkIdentity(selected) : ""));
  });

  const choose = (hash: string) => {
    const entry = entries.find((candidate) => candidate.hash === hash);
    if (!entry?.artifactTier || entry.artifactTier > maxTier) return;
    const next = slots.map((slot) => ({ ...slot, perk: slot.slot === activeSlot ? { ...namedEntryFromCatalog(entry), artifactTier: entry.artifactTier } : slot.perk }));
    onChange(serializeArtifactPerkSlots(next));
  };

  const clear = () => {
    onChange(serializeArtifactPerkSlots(slots.map((slot) => slot.slot === activeSlot ? { ...slot, perk: undefined } : slot)));
  };

  return <div className={styles.artifactPerkPicker}>
    <header className={styles.artifactPickerHeader}>
      <span><strong>Artifact 2.0 perk slots</strong><small>Slots 1–2 accept Tier 1; 3–5 accept Tier 2 or lower; 6–7 accept Tier 3 or lower. Perks cannot repeat.</small></span>
      <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search perks for slot ${activeSlot}`} /></label>
    </header>
    <div className={styles.artifactSlotGrid} aria-label="Seven equipped Artifact perk slots">
      {slots.map((slot) => <button type="button" key={slot.slot} data-active={slot.slot === activeSlot} data-filled={Boolean(slot.perk)} onClick={() => setActiveSlot(slot.slot)} aria-pressed={slot.slot === activeSlot}>
        <span><b>{slot.slot}</b><small>Tier {slot.maxTier} or lower</small></span>
        {slot.perk ? <><span className={styles.artifactSlotIcon}>{slot.perk.icon ? <img src={slot.perk.icon} alt="" /> : <AlertTriangle />}</span><strong>{slot.perk.name}</strong></> : <><i /><strong>Empty slot</strong></>}
      </button>)}
    </div>
    {result.isLoading && <p className={styles.artifactPickerStatus}>Reading current Artifact perks from the Bungie manifest…</p>}
    {result.error && <p className={styles.artifactPickerStatus}><AlertTriangle /> Artifact perk data is temporarily unavailable. Existing selections remain preserved.</p>}
    {!result.isLoading && !result.error && <section className={styles.artifactPerkChooser}>
      <header><span><b>{activeSlot}</b><div><strong>Slot {activeSlot}</strong><small>Choose any unique Tier {maxTier} or lower perk</small></div></span>{selected && <button type="button" onClick={clear}><Trash2 /> Clear slot</button>}</header>
      <div>{eligible.map((entry) => {
        const isCurrent = selected ? artifactPerkIdentity(entry) === artifactPerkIdentity(selected) : false;
        return <button type="button" key={entry.hash} data-selected={isCurrent} onClick={() => choose(entry.hash)} title={`${entry.name}\n${entry.description}`} aria-pressed={isCurrent}>
          <span className={styles.artifactPerkIcon}><img src={entry.icon} alt="" loading="lazy" />{isCurrent && <i><Check /></i>}</span>
          <span><small>Tier {entry.artifactTier}</small><strong>{entry.name}</strong><p>{entry.description}</p></span>
        </button>;
      })}</div>
      {!eligible.length && <p>No eligible perks match this search. Clear the filter or choose another slot.</p>}
    </section>}
    {slots.some((slot) => slot.perk && !slot.perk.artifactTier) && <p className={styles.artifactLegacyNotice}><AlertTriangle /> Bungie's current manifest could not resolve the tier for a legacy saved perk. It remains visible so you can replace or clear it safely.</p>}
  </div>;
}
