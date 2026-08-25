import type { CatalystState, CollectionData, ExoticCollectionEntry, QuestObjective } from "@guardian-nexus/contracts";
import { catalystTrackingId, sortCollectionEntries, xurSchedule, type CollectionSortMode } from "@guardian-nexus/domain";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Bookmark, Check, ChevronRight, Coins, Palette, Search, Shield, Sparkles, Swords, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api/client";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { collectionClassScope, collectionItemLabel, groupCollectionEntries, scopeCollectionEntries, type CollectionClassScope } from "../modules/collection/collectionGroups";
import { trapFocusWithin } from "../components/common/focusTrap";
import styles from "./Pages.module.css";

type KindFilter = "all" | "weapon" | "armor";
type OwnedFilter = "all" | "owned" | "missing";
type AvailabilityFilter = "all" | "xur";
type CollectionView = "exotics" | "catalysts";
type CatalystFilter = "all" | Exclude<CatalystState, "unavailable">;
type CatalystSortMode = "status" | "alpha" | "weapon" | "type";

export interface CatalystCollectionItem {
  recordHash: string;
  name: string;
  description: string;
  icon: string;
  state: Exclude<CatalystState, "unavailable">;
  objectives: QuestObjective[];
  percent: number;
  progressAvailable: boolean;
  trackedInDestiny: boolean;
  weapon: ExoticCollectionEntry;
}

export function CollectionPage() {
  const { selectedCharacterId, session, autoRefresh, preferences, setPreference } = useGuardian();
  const [view, setView] = useState<CollectionView>("exotics");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [owned, setOwned] = useState<OwnedFilter>("all");
  const [catalyst, setCatalyst] = useState<"all" | CatalystState>("all");
  const [catalystState, setCatalystState] = useState<CatalystFilter>("all");
  const [catalystSlot, setCatalystSlot] = useState("all");
  const [catalystType, setCatalystType] = useState("all");
  const [catalystSort, setCatalystSort] = useState<CatalystSortMode>("status");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [now, setNow] = useState(() => new Date());
  const selectedGuardianClass = session?.guardian?.characters.find((character) => character.characterId === selectedCharacterId)?.className;
  const [classScope, setClassScope] = useState<CollectionClassScope>("all");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const raw = preferences["collection.filters"];
    if (!raw) {
      setClassScope(collectionClassScope(selectedGuardianClass));
      return;
    }
    try {
      const stored = JSON.parse(raw) as Record<string, string>;
      if (["all", "weapon", "armor"].includes(stored.kind || "")) setKind(stored.kind as KindFilter);
      if (["all", "owned", "missing"].includes(stored.owned || "")) setOwned(stored.owned as OwnedFilter);
      if (["all", "missing", "obtained", "complete", "unavailable"].includes(stored.catalyst || "")) setCatalyst(stored.catalyst as "all" | CatalystState);
      if (["all", "xur"].includes(stored.availability || "")) setAvailability(stored.availability as AvailabilityFilter);
      setClassScope(["hunter", "titan", "warlock", "all"].includes(stored.classScope || "") ? stored.classScope as CollectionClassScope : collectionClassScope(selectedGuardianClass));
    } catch { /* Ignore malformed historical preferences. */ }
  }, [preferences, selectedGuardianClass]);
  const saveFilters = (next: Partial<{ kind: KindFilter; owned: OwnedFilter; catalyst: "all" | CatalystState; availability: AvailabilityFilter; classScope: CollectionClassScope }>) => setPreference("collection.filters", JSON.stringify({ kind, owned, catalyst, availability, classScope, ...next }));
  const sort = COLLECTION_SORTS.has(preferences["collection.sort"] as CollectionSortMode) ? preferences["collection.sort"] as CollectionSortMode : "position";
  const [selected, setSelected] = useState<ExoticCollectionEntry | null>(null);
  const [selectedCatalyst, setSelectedCatalyst] = useState<CatalystCollectionItem | null>(null);
  const result = useQuery({
    queryKey: ["collection", selectedCharacterId],
    queryFn: () => api<CollectionData>(`/api/v1/me/collection?characterId=${encodeURIComponent(selectedCharacterId)}`),
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 5 * 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  const tracked = useMemo(() => readTracked(preferences["collection.tracked"]), [preferences]);
  const toggleTracked = (trackingId: string) => {
    const next = new Set(tracked);
    if (next.has(trackingId)) next.delete(trackingId); else next.add(trackingId);
    setPreference("collection.tracked", JSON.stringify([...next]));
  };
  const xurSellingLive = Boolean(data?.xur.state === "available" && xurSchedule(now).active);
  useEffect(() => {
    if (!xurSellingLive && availability === "xur") setAvailability("all");
  }, [availability, xurSellingLive]);
  const scopedEntries = useMemo(() => scopeCollectionEntries(data?.entries || [], classScope), [data, classScope]);
  const entries = useMemo(() => sortCollectionEntries(scopedEntries.filter((entry) => {
    const text = `${entry.name} ${entry.itemType} ${entry.slot} ${entry.source}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (kind === "all" || entry.kind === kind)
      && (owned === "all" || (owned === "owned" ? entry.owned : !entry.owned))
      && (catalyst === "all" || (entry.kind === "weapon" && entry.catalyst === catalyst))
      && (availability === "all" || (xurSellingLive && entry.xurSelling));
  }), sort), [scopedEntries, query, kind, owned, catalyst, availability, sort, xurSellingLive]);
  const groups = useMemo(() => groupCollectionEntries(entries, classScope), [entries, classScope]);
  const catalystItems = useMemo(() => catalystCollectionItems(data?.entries || []), [data]);
  const catalystSlots = useMemo(() => uniqueLabels(catalystItems.map((item) => item.weapon.slot)), [catalystItems]);
  const catalystTypes = useMemo(() => uniqueLabels(catalystItems.map((item) => item.weapon.itemType)), [catalystItems]);
  const shownCatalysts = useMemo(() => filterCatalystCollectionItems(catalystItems, {
    query,
    state: catalystState,
    slot: catalystSlot,
    itemType: catalystType,
    sort: catalystSort
  }), [catalystItems, query, catalystState, catalystSlot, catalystType, catalystSort]);
  const totals = useMemo(() => ({
    owned: scopedEntries.filter((entry) => entry.owned).length,
    available: scopedEntries.length,
    catalystsAvailable: catalystItems.length,
    catalystsOwned: catalystItems.filter((item) => item.state === "obtained" || item.state === "complete").length,
    catalystsComplete: catalystItems.filter((item) => item.state === "complete").length
  }), [scopedEntries, catalystItems]);

  return <AuthGate>
    <PageHeader eyebrow="Your collection" title="Collection" description="Review account-wide collections and filter Exotic armor by class." actions={<><Link to="/fashion" style={{ minHeight: 34, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 9px", border: "1px solid var(--line)", color: "var(--ink)", textDecoration: "none" }}><Palette size={15} /> Fashion</Link><Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} /></>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.summaryGrid}>
        <Summary label="Exotics owned" value={`${totals.owned}/${totals.available}`} progress={totals.available ? totals.owned / totals.available : 0} icon={<Sparkles />} />
        <Summary label="Catalysts found" value={`${totals.catalystsOwned}/${totals.catalystsAvailable}`} progress={totals.catalystsAvailable ? totals.catalystsOwned / totals.catalystsAvailable : 0} icon={<BookOpen />} />
        <Summary label="Catalysts complete" value={String(totals.catalystsComplete)} progress={totals.catalystsOwned ? totals.catalystsComplete / totals.catalystsOwned : 0} icon={<Check />} />
        <Summary label="Manifest" value={data.manifestVersion === "offline-fallback" || data.manifestVersion === "unavailable" ? "Offline" : "Current"} progress={data.entries.length ? 1 : 0} icon={<Shield />} />
      </section>
      <nav className={styles.collectionViewTabs} aria-label="Collection view">
        <button type="button" aria-pressed={view === "exotics"} className={view === "exotics" ? styles.collectionViewActive : ""} onClick={() => setView("exotics")}><Sparkles /><span><strong>Exotics</strong><small>{totals.owned}/{totals.available} owned</small></span></button>
        <button type="button" aria-pressed={view === "catalysts"} className={view === "catalysts" ? styles.collectionViewActive : ""} onClick={() => setView("catalysts")}><BookOpen /><span><strong>Catalysts</strong><small>{totals.catalystsComplete}/{totals.catalystsAvailable} masterworked</small></span></button>
      </nav>
      {view === "exotics" ? <>
        <section className={`${styles.commandBar} ${styles.collectionCommandBar}`} aria-label="Exotic collection search and filters">
          <FilterGroup label="Class" value={classScope} values={["hunter", "titan", "warlock", "all"]} onChange={(value) => { const next = value as CollectionClassScope; setClassScope(next); saveFilters({ classScope: next }); }} />
          <label className={styles.search}><Search size={16} /><input type="search" data-page-search aria-label="Search Exotic collection" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Exotics, slots, sources…" /></label>
          <FilterGroup label="Type" value={kind} values={["all", "weapon", "armor"]} onChange={(value) => { const next = value as KindFilter; setKind(next); saveFilters({ kind: next }); }} />
          <FilterGroup label="Collection" value={owned} values={["all", "owned", "missing"]} onChange={(value) => { const next = value as OwnedFilter; setOwned(next); saveFilters({ owned: next }); }} />
          {xurSellingLive && <FilterGroup label="Availability" value={availability} values={["all", "xur"]} labels={{ xur: "Xûr" }} onChange={(value) => { const next = value as AvailabilityFilter; setAvailability(next); saveFilters({ availability: next }); }} />}
          <label className={styles.selectFilter}><span>Catalyst</span><select value={catalyst} onChange={(event) => { const next = event.target.value as typeof catalyst; setCatalyst(next); saveFilters({ catalyst: next }); }}><option value="all">All states</option><option value="missing">Missing</option><option value="obtained">Obtained</option><option value="complete">Complete</option><option value="unavailable">No catalyst</option></select></label>
          <label className={styles.selectFilter}><span>Sort</span><select value={sort} onChange={(event) => setPreference("collection.sort", event.target.value)}><option value="position">Position + A–Z</option><option value="type">Type + A–Z</option><option value="alpha">Name A–Z</option><option value="missing">Missing first</option><option value="owned">Owned first</option><option value="source">Acquisition source</option></select></label>
          <strong className={styles.resultCount}>{entries.length} shown</strong>
        </section>
        {entries.length ? <div className={styles.collectionSections}>
          {groups.map((group) => <section className={styles.collectionSection} key={group.id}>
            <header><div><span>{group.eyebrow}</span><h2>{group.title}</h2></div><strong>{group.entries.length} shown</strong></header>
            <div className={styles.itemGrid}>{group.entries.map((entry) => <ItemCard key={`${entry.itemHash}-${entry.className || "weapon"}`} entry={entry} xurSellingLive={xurSellingLive} onOpen={() => { setSelectedCatalyst(null); setSelected(entry); }} />)}</div>
          </section>)}
        </div> : <div className={styles.inlineEmpty}><Sparkles /><h2>No Exotics match this view</h2><p>Adjust filters, or run the manifest sync if the catalog reports Offline.</p></div>}
      </> : <>
        <section className={`${styles.commandBar} ${styles.collectionCommandBar}`} aria-label="Catalyst collection search and filters">
          <label className={styles.search}><Search size={16} /><input type="search" data-page-search aria-label="Search catalyst collection" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search catalysts or Exotic weapons…" /></label>
          <FilterGroup label="Status" value={catalystState} values={["all", "missing", "obtained", "complete"]} labels={{ obtained: "Acquired", complete: "Masterworked" }} onChange={(value) => setCatalystState(value as CatalystFilter)} />
          <label className={styles.selectFilter}><span>Weapon slot</span><select value={catalystSlot} onChange={(event) => setCatalystSlot(event.target.value)}><option value="all">All slots</option>{catalystSlots.map((slot) => <option value={slot} key={slot}>{slot}</option>)}</select></label>
          <label className={styles.selectFilter}><span>Weapon type</span><select value={catalystType} onChange={(event) => setCatalystType(event.target.value)}><option value="all">All types</option>{catalystTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
          <label className={styles.selectFilter}><span>Sort</span><select value={catalystSort} onChange={(event) => setCatalystSort(event.target.value as CatalystSortMode)}><option value="status">Actionable first</option><option value="alpha">Catalyst A–Z</option><option value="weapon">Weapon A–Z</option><option value="type">Weapon type</option></select></label>
          <strong className={styles.resultCount}>{shownCatalysts.length} shown</strong>
        </section>
        {shownCatalysts.length ? <section className={styles.catalystCollection}>
          <header><div><span>Patterns &amp; catalysts</span><h2>Exotic Weapon Catalysts</h2></div><strong>{totals.catalystsOwned} acquired · {totals.catalystsComplete} masterworked</strong></header>
          <div className={styles.catalystGrid}>{shownCatalysts.map((item) => <CatalystCard key={`${item.weapon.itemHash}-${item.recordHash}`} item={item} tracked={tracked.has(catalystTrackingId(item.recordHash))} onToggleTracked={() => toggleTracked(catalystTrackingId(item.recordHash))} onOpen={() => { setSelected(item.weapon); setSelectedCatalyst(item); }} />)}</div>
        </section> : <div className={styles.inlineEmpty}><BookOpen /><h2>No catalysts match this view</h2><p>Adjust the status, slot, weapon type, or search filters.</p></div>}
      </>}
    </>}
    <GuideDrawer entry={selected} focusedCatalyst={selectedCatalyst} xurSellingLive={xurSellingLive} tracked={Boolean(selected && tracked.has(selectedCatalyst ? catalystTrackingId(selectedCatalyst.recordHash) : selected.itemHash))} onToggleTracked={() => selected && toggleTracked(selectedCatalyst ? catalystTrackingId(selectedCatalyst.recordHash) : selected.itemHash)} onClose={() => { setSelected(null); setSelectedCatalyst(null); }} />
  </AuthGate>;
}

const COLLECTION_SORTS = new Set<CollectionSortMode>(["position", "type", "alpha", "missing", "owned", "source"]);

function Summary({ label, value, progress, icon }: { label: string; value: string; progress: number; icon: React.ReactNode }) {
  return <article className={styles.summary}><i>{icon}</i><span>{label}</span><strong>{value}</strong><div><span style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} /></div></article>;
}

function FilterGroup({ label, value, values, labels = {}, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <div className={styles.filterGroup}><span>{label}</span><div>{values.map((entry) => <button type="button" key={entry} aria-pressed={value === entry} className={value === entry ? styles.activeFilter : ""} onClick={() => onChange(entry)}>{labels[entry] || entry}</button>)}</div></div>;
}

function ItemCard({ entry, xurSellingLive, onOpen }: { entry: ExoticCollectionEntry; xurSellingLive: boolean; onOpen: () => void }) {
  return <button className={`${styles.itemCard} ${entry.owned ? styles.owned : styles.missing}`} onClick={onOpen}>
    <div className={styles.itemArt}>{entry.icon ? <img src={entry.icon} alt="" loading="lazy" /> : <span>{entry.kind === "weapon" ? <Swords /> : <Shield />}</span>}{entry.watermark && <img className={styles.watermark} src={entry.watermark} alt="" />}</div>
    <div className={styles.itemBody}><span>{collectionItemLabel(entry)}</span><h2>{entry.name}</h2><p>{entry.itemType}</p></div>
    <div className={styles.itemState}>{xurSellingLive && entry.xurSelling && <StateBadge active label="Xûr selling" gold icon={<Coins size={10} />} />}<StateBadge active={entry.owned} label={entry.owned ? "Owned" : "Missing"} />{entry.kind === "weapon" && <StateBadge active={entry.catalyst === "obtained" || entry.catalyst === "complete"} label={catalystLabel(entry.catalyst)} gold={entry.catalyst === "complete"} />}</div>
    <ChevronRight className={styles.chevron} size={18} />
  </button>;
}

function CatalystCard({ item, tracked, onToggleTracked, onOpen }: { item: CatalystCollectionItem; tracked: boolean; onToggleTracked: () => void; onOpen: () => void }) {
  const stateClass = item.state === "complete" ? styles.catalystComplete : item.state === "obtained" ? styles.catalystObtained : styles.catalystMissing;
  const objective = item.objectives.find((entry) => !entry.complete) || item.objectives[0];
  return <article className={`${styles.catalystCard} ${stateClass}`}>
    <button type="button" className={styles.catalystCardOpen} onClick={onOpen}>
      <div className={styles.catalystArt}>{item.icon ? <img src={item.icon} alt="" loading="lazy" /> : <BookOpen />}{item.state === "complete" && <span><Check /></span>}</div>
      <div className={styles.catalystBody}><span>{catalystViewLabel(item.state)}</span><h3>{item.name}</h3><p>{item.weapon.name}</p><small>{item.weapon.itemType} · {item.weapon.slot}</small>{objective && <CatalystObjective objective={objective} progressAvailable={item.progressAvailable} />}</div>
      <ChevronRight className={styles.chevron} size={18} />
    </button>
    {item.state === "obtained" && <button type="button" className={`${styles.catalystTrackAction} ${tracked ? styles.catalystTrackActionActive : ""}`} onClick={onToggleTracked} aria-pressed={tracked} aria-label={`${tracked ? "Untrack" : "Track"} ${item.name} on Fireteam`}><Bookmark fill={tracked ? "currentColor" : "none"} />{tracked ? "Tracked" : "Track"}</button>}
  </article>;
}

function CatalystObjective({ objective, progressAvailable }: { objective: QuestObjective; progressAvailable: boolean }) {
  const value = objective.complete ? "Complete" : progressAvailable && objective.completionValue > 0
    ? `${objective.progress.toLocaleString()} / ${objective.completionValue.toLocaleString()}`
    : objective.completionValue > 0 ? `${objective.completionValue.toLocaleString()} required` : "Progress unavailable";
  return <div className={styles.catalystObjective}><span>{objective.name}</span><strong>{value}</strong><i><span style={{ width: `${progressAvailable ? objective.percent : 0}%` }} /></i></div>;
}

function StateBadge({ active, label, gold, icon }: { active: boolean; label: string; gold?: boolean; icon?: React.ReactNode }) {
  return <span className={`${styles.stateBadge} ${active ? styles.stateActive : ""} ${gold ? styles.stateGold : ""}`}><i>{icon || (active && <Check size={10} />)}</i>{label}</span>;
}

function catalystLabel(state: CatalystState): string {
  return state === "unavailable" ? "No catalyst" : state === "missing" ? "Catalyst missing" : state === "obtained" ? "Catalyst found" : "Catalyst complete";
}

function catalystViewLabel(state: CatalystCollectionItem["state"]): string {
  return state === "missing" ? "Not acquired" : state === "obtained" ? "Acquired" : "Masterworked";
}

function GuideDrawer({ entry, focusedCatalyst, xurSellingLive, tracked, onToggleTracked, onClose }: { entry: ExoticCollectionEntry | null; focusedCatalyst: CatalystCollectionItem | null; xurSellingLive: boolean; tracked: boolean; onToggleTracked: () => void; onClose: () => void }) {
  const open = Boolean(entry);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeHandlerRef = useRef(onClose);
  closeHandlerRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      trapFocusWithin(event, panelRef.current);
      if (event.key === "Escape") closeHandlerRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [open]);
  return <><button className={`${styles.drawerScrim} ${open ? styles.drawerOpen : ""}`} onClick={onClose} aria-label="Close guide" tabIndex={open ? 0 : -1} /><aside ref={panelRef} className={`${styles.guideDrawer} ${open ? styles.drawerOpen : ""}`} aria-hidden={!open} inert={!open} role="dialog" aria-modal={open ? "true" : undefined} aria-label={focusedCatalyst ? "Catalyst details" : "Exotic acquisition guide"}>
    {entry && <><header><div><span>{focusedCatalyst ? "Catalyst details" : "Acquisition guide"}</span><h2>{focusedCatalyst?.name || entry.name}</h2></div><button ref={closeRef} onClick={onClose} aria-label="Close guide"><X /></button></header>
      <div className={styles.guideHero}>{(focusedCatalyst?.icon || entry.icon) && <img src={focusedCatalyst?.icon || entry.icon} alt="" />}<div><span>{focusedCatalyst ? `${entry.name} · ${catalystViewLabel(focusedCatalyst.state)}` : `${entry.kind} · ${entry.slot}`}</span><p>{focusedCatalyst?.description || entry.description || "Description unavailable."}</p>{!focusedCatalyst && <b className={`${styles.confidence} ${styles[entry.guide.confidence]}`}>{entry.guide.confidence}</b>}</div></div>
      {((focusedCatalyst && focusedCatalyst.state === "obtained") || (!focusedCatalyst && !entry.owned)) && <button type="button" className={`${styles.guideTrackAction} ${tracked ? styles.guideTrackActionActive : ""}`} onClick={onToggleTracked} aria-pressed={tracked}><Bookmark fill={tracked ? "currentColor" : "none"} />{tracked ? "Tracked on Fireteam" : "Track on Fireteam"}</button>}
      <div className={styles.guideFacts}>{focusedCatalyst ? <><div><span>Status</span><strong>{catalystViewLabel(focusedCatalyst.state)}</strong></div><div><span>Weapon</span><strong>{entry.name}</strong></div><div><span>Type</span><strong>{entry.itemType}</strong></div><div><span>Slot</span><strong>{entry.slot}</strong></div></> : <><div><span>Collection</span><strong>{entry.owned ? "Owned" : "Missing"}</strong></div><div><span>Type</span><strong>{entry.itemType}</strong></div><div><span>Slot</span><strong>{entry.slot}</strong></div>{entry.damageType && <div><span>Damage</span><strong>{entry.damageType}</strong></div>}</>}</div>
      {xurSellingLive && entry.xurSelling && <GuideSection title="Available from Xûr"><p>Available in Xûr's current inventory.</p></GuideSection>}
      <GuideSection title={focusedCatalyst ? "Weapon source" : "Current source"}><p>{entry.guide.acquisition}</p></GuideSection>
      {!focusedCatalyst && <GuideSection title="Acquisition steps"><ol>{entry.guide.steps.length ? entry.guide.steps.map((step, index) => <li key={index}>{step}</li>) : <li>Acquisition steps unavailable.</li>}</ol></GuideSection>}
      {!focusedCatalyst && entry.guide.prerequisites.length > 0 && <GuideSection title="Prerequisites"><ul>{entry.guide.prerequisites.map((step, index) => <li key={index}>{step}</li>)}</ul></GuideSection>}
      {focusedCatalyst && entry.guide.catalystCompletion && <GuideSection title="Completion"><p>{entry.guide.catalystCompletion}</p></GuideSection>}
      {focusedCatalyst && focusedCatalyst.objectives.length > 0 && <GuideSection title="Masterwork progress"><div className={styles.catalystObjectiveList}>{focusedCatalyst.objectives.map((objective) => <CatalystObjective key={objective.objectiveHash} objective={objective} progressAvailable={focusedCatalyst.progressAvailable} />)}</div></GuideSection>}
      {entry.kind === "weapon" && <GuideSection title={entry.catalysts?.length === 1 ? "Catalyst" : "Catalysts"}>{entry.catalysts?.length ? <div className={styles.guideFeatureList}>{entry.catalysts.map((catalystEntry) => <article key={catalystEntry.recordHash}>{catalystEntry.icon ? <img src={catalystEntry.icon} alt="" /> : <BookOpen />}<div><span>{catalystLabel(catalystEntry.state)}</span><strong>{catalystEntry.name}</strong><p>{catalystEntry.description}</p></div></article>)}</div> : <p>No catalyst is currently mapped for this weapon.</p>}{!focusedCatalyst && entry.guide.catalystCompletion && <p>{entry.guide.catalystCompletion}</p>}</GuideSection>}
      {Boolean(entry.features?.length) && <GuideSection title="Selectable features and sockets"><div className={styles.guideFeatureList}>{entry.features!.map((feature) => <article key={feature.itemHash}>{feature.icon ? <img src={feature.icon} alt="" /> : <Sparkles />}<div><strong>{feature.name}</strong><p>{feature.description}</p></div></article>)}</div></GuideSection>}
      <GuideSection title="Verification"><p>{entry.guide.verifiedAt ? `Verified ${new Date(entry.guide.verifiedAt).toLocaleDateString()}.` : "Needs a current source verification pass."}</p>{entry.guide.sources.map((source) => source.url ? <a key={source.label} href={source.url} target="_blank" rel="noreferrer">{source.label} <ChevronRight size={13} /></a> : <span key={source.label}>{source.label}</span>)}</GuideSection>
    </>}
  </aside></>;
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.guideSection}><h3>{title}</h3>{children}</section>; }

function readTracked(value?: string): Set<string> {
  try {
    const parsed = JSON.parse(value || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, 200) : []);
  } catch { return new Set(); }
}

export function catalystCollectionItems(entries: ExoticCollectionEntry[]): CatalystCollectionItem[] {
  return entries.flatMap((weapon) => {
    if (weapon.kind !== "weapon" || weapon.catalyst === "unavailable") return [];
    const records = (weapon.catalysts || []).filter((entry): entry is typeof entry & { state: Exclude<CatalystState, "unavailable"> } => entry.state !== "unavailable");
    if (records.length) return records.map((record) => ({ ...record, weapon }));
    return [{
      recordHash: `weapon-${weapon.itemHash}`,
      name: `${weapon.name} Catalyst`,
      description: weapon.guide.catalystCompletion || "Open the catalyst record in Destiny for its current objective.",
      icon: weapon.icon,
      state: weapon.catalyst,
      objectives: [],
      percent: weapon.catalyst === "complete" ? 100 : 0,
      progressAvailable: false,
      trackedInDestiny: false,
      weapon
    }];
  });
}

export function filterCatalystCollectionItems(items: CatalystCollectionItem[], filters: { query: string; state: CatalystFilter; slot: string; itemType: string; sort: CatalystSortMode }): CatalystCollectionItem[] {
  const query = filters.query.trim().toLowerCase();
  const statusOrder: Record<CatalystCollectionItem["state"], number> = { obtained: 0, missing: 1, complete: 2 };
  return items.filter((item) => {
    const search = `${item.name} ${item.description} ${item.weapon.name} ${item.weapon.itemType} ${item.weapon.slot}`.toLowerCase();
    return (!query || search.includes(query))
      && (filters.state === "all" || item.state === filters.state)
      && (filters.slot === "all" || item.weapon.slot === filters.slot)
      && (filters.itemType === "all" || item.weapon.itemType === filters.itemType);
  }).sort((left, right) => {
    if (filters.sort === "status") return statusOrder[left.state] - statusOrder[right.state] || left.weapon.name.localeCompare(right.weapon.name) || left.name.localeCompare(right.name);
    if (filters.sort === "weapon") return left.weapon.name.localeCompare(right.weapon.name) || left.name.localeCompare(right.name);
    if (filters.sort === "type") return left.weapon.itemType.localeCompare(right.weapon.itemType) || left.weapon.name.localeCompare(right.weapon.name);
    return left.name.localeCompare(right.name);
  });
}

function uniqueLabels(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
