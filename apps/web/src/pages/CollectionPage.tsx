import type { CatalystState, CollectionData, ExoticCollectionEntry } from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, ChevronRight, Coins, Search, Shield, Sparkles, Swords, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/Page";
import { useGuardian } from "../state/GuardianContext";
import styles from "./Pages.module.css";

type KindFilter = "all" | "weapon" | "armor";
type OwnedFilter = "all" | "owned" | "missing";
type AvailabilityFilter = "all" | "xur";

export function CollectionPage() {
  const { selectedCharacterId, session, autoRefresh } = useGuardian();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [owned, setOwned] = useState<OwnedFilter>("all");
  const [catalyst, setCatalyst] = useState<"all" | CatalystState>("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [selected, setSelected] = useState<ExoticCollectionEntry | null>(null);
  const result = useQuery({
    queryKey: ["collection", selectedCharacterId],
    queryFn: () => api<CollectionData>(`/api/v1/me/collection?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 5 * 60_000 : false,
    refetchIntervalInBackground: false
  });
  const entries = useMemo(() => (result.data?.data.entries || []).filter((entry) => {
    const text = `${entry.name} ${entry.itemType} ${entry.slot} ${entry.source}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (kind === "all" || entry.kind === kind)
      && (owned === "all" || (owned === "owned" ? entry.owned : !entry.owned))
      && (catalyst === "all" || (entry.kind === "weapon" && entry.catalyst === catalyst))
      && (availability === "all" || entry.xurSelling);
  }), [result.data, query, kind, owned, catalyst, availability]);
  const data = result.data?.data;

  return <AuthGate>
    <PageHeader eyebrow="Personal archive" title="Collection" description="Every current Exotic weapon and class-valid armor piece, reconciled against your Bungie collection with catalyst progress kept separate." actions={<Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} />} />
    <QueryState loading={result.isLoading} error={result.error as Error} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.summaryGrid}>
        <Summary label="Exotics owned" value={`${data.totals.owned}/${data.totals.available}`} progress={data.totals.available ? data.totals.owned / data.totals.available : 0} icon={<Sparkles />} />
        <Summary label="Catalysts found" value={`${data.totals.catalystsOwned}/${data.totals.catalystsAvailable}`} progress={data.totals.catalystsAvailable ? data.totals.catalystsOwned / data.totals.catalystsAvailable : 0} icon={<BookOpen />} />
        <Summary label="Catalysts complete" value={String(data.totals.catalystsComplete)} progress={data.totals.catalystsOwned ? data.totals.catalystsComplete / data.totals.catalystsOwned : 0} icon={<Check />} />
        <Summary label="Manifest" value={data.manifestVersion === "offline-fallback" || data.manifestVersion === "unavailable" ? "Offline" : "Current"} progress={data.entries.length ? 1 : 0} icon={<Shield />} />
      </section>
      <section className={styles.commandBar}>
        <label className={styles.search}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Exotics, slots, sources…" /></label>
        <FilterGroup label="Type" value={kind} values={["all", "weapon", "armor"]} onChange={(value) => setKind(value as KindFilter)} />
        <FilterGroup label="Collection" value={owned} values={["all", "owned", "missing"]} onChange={(value) => setOwned(value as OwnedFilter)} />
        <FilterGroup label="Availability" value={availability} values={["all", "xur"]} labels={{ xur: "Xûr" }} onChange={(value) => setAvailability(value as AvailabilityFilter)} />
        <label className={styles.selectFilter}><span>Catalyst</span><select value={catalyst} onChange={(event) => setCatalyst(event.target.value as typeof catalyst)}><option value="all">All states</option><option value="missing">Missing</option><option value="obtained">Obtained</option><option value="complete">Complete</option><option value="unavailable">No catalyst</option></select></label>
        <strong className={styles.resultCount}>{entries.length} shown</strong>
      </section>
      {entries.length ? <section className={styles.itemGrid}>
        {entries.map((entry) => <ItemCard key={`${entry.itemHash}-${entry.className || "weapon"}`} entry={entry} onOpen={() => setSelected(entry)} />)}
      </section> : <div className={styles.inlineEmpty}><Sparkles /><h2>No Exotics match this view</h2><p>Adjust filters, or run the manifest sync if the catalog reports Offline.</p></div>}
    </>}
    <GuideDrawer entry={selected} onClose={() => setSelected(null)} />
  </AuthGate>;
}

function Summary({ label, value, progress, icon }: { label: string; value: string; progress: number; icon: React.ReactNode }) {
  return <article className={styles.summary}><i>{icon}</i><span>{label}</span><strong>{value}</strong><div><span style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} /></div></article>;
}

function FilterGroup({ label, value, values, labels = {}, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <div className={styles.filterGroup}><span>{label}</span><div>{values.map((entry) => <button key={entry} className={value === entry ? styles.activeFilter : ""} onClick={() => onChange(entry)}>{labels[entry] || entry}</button>)}</div></div>;
}

function ItemCard({ entry, onOpen }: { entry: ExoticCollectionEntry; onOpen: () => void }) {
  return <button className={`${styles.itemCard} ${entry.owned ? styles.owned : styles.missing}`} onClick={onOpen}>
    <div className={styles.itemArt}>{entry.icon ? <img src={entry.icon} alt="" loading="lazy" /> : <span>{entry.kind === "weapon" ? <Swords /> : <Shield />}</span>}{entry.watermark && <img className={styles.watermark} src={entry.watermark} alt="" />}</div>
    <div className={styles.itemBody}><span>{entry.kind} · {entry.slot}</span><h2>{entry.name}</h2><p>{entry.itemType}</p></div>
    <div className={styles.itemState}>{entry.xurSelling && <StateBadge active label="Xûr selling" gold icon={<Coins size={10} />} />}<StateBadge active={entry.owned} label={entry.owned ? "Owned" : "Missing"} />{entry.kind === "weapon" && <StateBadge active={entry.catalyst === "obtained" || entry.catalyst === "complete"} label={catalystLabel(entry.catalyst)} gold={entry.catalyst === "complete"} />}</div>
    <ChevronRight className={styles.chevron} size={18} />
  </button>;
}

function StateBadge({ active, label, gold, icon }: { active: boolean; label: string; gold?: boolean; icon?: React.ReactNode }) {
  return <span className={`${styles.stateBadge} ${active ? styles.stateActive : ""} ${gold ? styles.stateGold : ""}`}><i>{icon || (active && <Check size={10} />)}</i>{label}</span>;
}

function catalystLabel(state: CatalystState): string {
  return state === "unavailable" ? "No catalyst" : state === "missing" ? "Catalyst missing" : state === "obtained" ? "Catalyst found" : "Catalyst complete";
}

function GuideDrawer({ entry, onClose }: { entry: ExoticCollectionEntry | null; onClose: () => void }) {
  return <><button className={`${styles.drawerScrim} ${entry ? styles.drawerOpen : ""}`} onClick={onClose} aria-label="Close guide" /><aside className={`${styles.guideDrawer} ${entry ? styles.drawerOpen : ""}`} aria-hidden={!entry}>
    {entry && <><header><div><span>Acquisition guide</span><h2>{entry.name}</h2></div><button onClick={onClose}><X /></button></header>
      <div className={styles.guideHero}>{entry.icon && <img src={entry.icon} alt="" />}<div><span>{entry.kind} · {entry.slot}</span><p>{entry.description || "No description returned."}</p><b className={`${styles.confidence} ${styles[entry.guide.confidence]}`}>{entry.guide.confidence}</b></div></div>
      {entry.xurSelling && <GuideSection title="Available from Xûr"><p>Xûr is selling this item in the latest live Bungie vendor inventory check.</p></GuideSection>}
      <GuideSection title="Current source"><p>{entry.guide.acquisition}</p></GuideSection>
      <GuideSection title="Acquisition steps"><ol>{entry.guide.steps.length ? entry.guide.steps.map((step, index) => <li key={index}>{step}</li>) : <li>Verification pending. No steps will be invented.</li>}</ol></GuideSection>
      {entry.guide.prerequisites.length > 0 && <GuideSection title="Prerequisites"><ul>{entry.guide.prerequisites.map((step, index) => <li key={index}>{step}</li>)}</ul></GuideSection>}
      {entry.kind === "weapon" && <GuideSection title="Catalyst"><p>{entry.guide.catalystSource || "No catalyst is currently mapped for this weapon."}</p>{entry.guide.catalystCompletion && <p>{entry.guide.catalystCompletion}</p>}</GuideSection>}
      <GuideSection title="Verification"><p>{entry.guide.verifiedAt ? `Verified ${new Date(entry.guide.verifiedAt).toLocaleDateString()}.` : "Needs a current source verification pass."}</p>{entry.guide.sources.map((source) => source.url ? <a key={source.label} href={source.url} target="_blank" rel="noreferrer">{source.label} <ChevronRight size={13} /></a> : <span key={source.label}>{source.label}</span>)}</GuideSection>
    </>}
  </aside></>;
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.guideSection}><h3>{title}</h3>{children}</section>; }
