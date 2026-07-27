import type {
  BuildAdvisorArmorEvaluation,
  BuildAdvisorAssemblyStatus,
  BuildAdvisorCategory,
  BuildAdvisorData,
  BuildAdvisorOwnedItem,
  BuildAdvisorRecommendation,
  BuildAdvisorWeaponEvaluation,
  BuildArmorMods,
  BuildNamedEntry
} from "@guardian-nexus/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Crosshair,
  Gauge,
  Puzzle,
  Radar,
  RefreshCw,
  ScanSearch,
  Shield,
  Sparkles,
  Swords,
  Vault
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { storeAdvisorBuildImport } from "../modules/builds/advisorBuildImport";
import { api } from "../services/api/client";
import styles from "./BuildAdvisorPage.module.css";

const STATUS_LABELS: Record<BuildAdvisorAssemblyStatus, string> = {
  "fully-assembleable": "Ready now",
  "assembleable-with-substitutions": "Ready with substitutions",
  "missing-one-important-item": "Missing one important item",
  "missing-several-core-items": "Missing several core items",
  "not-viable": "Not viable"
};

export function BuildAdvisorPage() {
  return <AuthGate><BuildAdvisor /></AuthGate>;
}

function BuildAdvisor() {
  const { session, selectedCharacterId, selectCharacter, autoRefresh, refresh } = useGuardian();
  const navigate = useNavigate();
  const forceNext = useRef(false);
  const [category, setCategory] = useState<BuildAdvisorCategory | "All">("All");
  const [selectedId, setSelectedId] = useState("");
  const result = useQuery({
    queryKey: ["build-advisor", selectedCharacterId],
    queryFn: () => {
      const force = forceNext.current;
      forceNext.current = false;
      return api<BuildAdvisorData>(`/api/v1/me/build-advisor?characterId=${encodeURIComponent(selectedCharacterId)}${force ? "&refresh=1" : ""}`);
    },
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchIntervalInBackground: false
  });
  const data = result.data?.data;
  const categories = useMemo(() => [...new Set(data?.recommendations.flatMap((recommendation) => recommendation.categories) || [])], [data?.recommendations]);
  const recommendations = useMemo(() => data?.recommendations.filter((recommendation) => category === "All" || recommendation.categories.includes(category)) || [], [category, data?.recommendations]);
  const selected = recommendations.find((recommendation) => recommendation.id === selectedId) || recommendations[0];
  const warning = result.data?.warnings[0] || data?.analysis.warnings[0];

  const refreshInventory = async () => {
    forceNext.current = true;
    await refresh();
    await result.refetch();
  };
  const openInBuilder = (recommendation: BuildAdvisorRecommendation) => {
    const token = storeAdvisorBuildImport({ sourceName: `Build Advisor · ${recommendation.name}`, document: recommendation.build });
    navigate(`/builds/new?fromAdvisor=${encodeURIComponent(token)}`);
  };

  return <>
    <PageHeader
      eyebrow="Owned gear intelligence"
      title="Build Advisor"
      description="Owned gear matched against reviewed, deterministic build templates."
      actions={<>
        <Freshness observedAt={result.data?.freshness.sourceMintedAt || data?.analysis.syncTimestamp} warning={warning} />
        <button type="button" className={styles.refresh} disabled={result.isFetching} onClick={() => void refreshInventory()}><RefreshCw className={result.isFetching ? styles.spin : ""} /> {result.isFetching ? "Refreshing…" : "Refresh inventory"}</button>
      </>}
    />
    <section className={styles.commandBar}>
      <label><span>Character</span><select value={selectedCharacterId} onChange={(event) => selectCharacter(event.target.value)}>
        {session?.guardian?.characters.map((character) => <option key={character.characterId} value={character.characterId}>{character.className} · {character.power} Power</option>)}
      </select></label>
      {data && <div className={styles.syncState} data-state={data.state}><i /> <span><b>{stateLabel(data.state)}</b><small>{data.characterClass} · {data.characterPower} Power · Template set v{data.templateSetVersion}</small></span></div>}
      {data && <div className={styles.reviewDate}><CircleHelp /><span><b>Templates reviewed {new Date(`${data.templateReviewedAt}T00:00:00`).toLocaleDateString()}</b><small>Recheck after sandbox or Artifact changes.</small></span></div>}
    </section>
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      {data.state !== "current" && <section className={styles.dataWarning} role="status"><AlertTriangle /><div><strong>{stateLabel(data.state)}</strong><p>{warning || "Refresh inventory before relying on these recommendations."}</p></div></section>}
      {data.recommendations.length ? <>
        <nav className={styles.filters} aria-label="Recommendation categories">
          <button type="button" data-active={category === "All"} onClick={() => setCategory("All")}>All recommendations</button>
          {categories.map((entry) => <button key={entry} type="button" data-active={category === entry} onClick={() => setCategory(entry)}>{entry}</button>)}
        </nav>
        <div className={styles.workspace}>
          <section className={styles.cardGrid} aria-label="Build recommendations">
            {recommendations.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} selected={selected?.id === recommendation.id} onSelect={() => setSelectedId(recommendation.id)} />)}
          </section>
          {selected && <RecommendationDetail recommendation={selected} canOpenBuilder={Boolean(session?.roles.buildEditor)} onOpenBuilder={() => openInBuilder(selected)} />}
        </div>
      </> : <section className={styles.empty}><ScanSearch /><h2>No strong near-complete build found</h2><p>Open inventory analysis to see which core pieces are missing, then refresh after your inventory changes.</p></section>}
      <InventoryAnalysis data={data} />
    </>}
  </>;
}

function RecommendationCard({ recommendation, selected, onSelect }: { recommendation: BuildAdvisorRecommendation; selected: boolean; onSelect: () => void }) {
  const armor = recommendation.coreExoticArmor;
  return <button type="button" className={styles.card} data-selected={selected} data-status={recommendation.status} onClick={onSelect}>
    <header>
      <div className={styles.score} style={{ "--score": recommendation.score } as React.CSSProperties}><strong>{recommendation.score}</strong><small>/ 100</small></div>
      <div><span>{recommendation.classType} · {recommendation.subclass}</span><h2>{recommendation.name}</h2></div>
    </header>
    <div className={styles.status}><i /><strong>{STATUS_LABELS[recommendation.status]}</strong></div>
    <p>{recommendation.reason}</p>
    <div className={styles.coreItem}>{armor.icon ? <img src={armor.icon} alt="" /> : <Shield />}<span><small>Core exotic</small><b>{armor.name}</b></span></div>
    <div className={styles.cardMetrics}><span><Swords /> Damage <b>{recommendation.damageProfile}</b></span><span><Shield /> Survival <b>{recommendation.survivability}</b></span><span><Gauge /> Complexity <b>{recommendation.complexity}</b></span></div>
    <footer>{recommendation.categories.map((entry) => <span key={entry}>{entry}</span>)}</footer>
  </button>;
}

function RecommendationDetail({ recommendation, canOpenBuilder, onOpenBuilder }: { recommendation: BuildAdvisorRecommendation; canOpenBuilder: boolean; onOpenBuilder: () => void }) {
  const build = recommendation.build;
  const abilities: Array<[string, BuildNamedEntry | undefined]> = [
    ["Super", build.subclassConfig.super],
    ...(build.subclass === "prismatic" ? [["Transcendence", build.subclassConfig.transcendence] as [string, BuildNamedEntry | undefined]] : []),
    ["Class ability", build.subclassConfig.classAbility],
    ["Movement", build.subclassConfig.movement],
    ["Melee", build.subclassConfig.melee],
    ["Grenade", build.subclassConfig.grenade]
  ];
  return <aside className={styles.detail}>
    <header><span>Assembly report</span><h2>{recommendation.name}</h2><p>{recommendation.style}</p></header>
    <section className={styles.factorList}><h3><Gauge /> Score factors</h3>{recommendation.factors.map((factor) => <div key={factor.id}><span><b>{factor.label}</b><small>{factor.detail}</small></span><em>{factor.earned}/{factor.available}</em><i><span style={{ width: `${factor.available ? factor.earned / factor.available * 100 : 0}%` }} /></i></div>)}</section>
    <section><h3><Shield /> Five-piece armor plan</h3><div className={styles.armorList}>{recommendation.armor.map((entry) => <ArmorMatch key={entry.slot} armor={entry} />)}</div></section>
    <section><h3><Crosshair /> Three-weapon loadout</h3><div className={styles.weaponList}>{recommendation.weapons.map((weapon) => <WeaponMatch key={weapon.requirementId} weapon={weapon} />)}</div></section>
    <section className={styles.subclassPlan}>
      <h3><Sparkles /> {build.subclass} subclass configuration</h3>
      <div className={styles.abilityGrid}>{abilities.map(([label, entry]) => <PlanEntry key={label} label={label} entry={entry} />)}</div>
      <PlanGroup title="Aspects" entries={build.subclassConfig.aspects} />
      <PlanGroup title="Fragments" entries={build.subclassConfig.fragments} />
    </section>
    <section className={styles.statPlan}>
      <h3><Gauge /> Six-stat investment</h3>
      <div>{[...build.statPriorities].sort((left, right) => left.priority - right.priority).map((entry) => <article key={entry.stat}><i>{entry.priority}</i><span><b>{entry.stat}</b><small>{entry.notes}</small></span><strong>{entry.target ?? "Flexible"}</strong></article>)}</div>
    </section>
    <section className={styles.ghostPlan}>
      <h3><Radar /> Ghost armorer focus</h3>
      <PlanEntry label={`${recommendation.ghostFocus.primaryStat} primary · ${recommendation.ghostFocus.secondaryStat} secondary`} entry={recommendation.ghostFocus.mod} />
      {recommendation.ghostFocus.notes && <p>{recommendation.ghostFocus.notes}</p>}
    </section>
    <section className={styles.modPlan}>
      <h3><Puzzle /> Armor sockets</h3>
      <div>{(Object.entries(build.armorMods) as Array<[keyof BuildArmorMods, BuildNamedEntry[]]>).map(([slot, entries]) => <article key={slot}><b>{armorSlotLabel(slot)}</b><span>{entries.map((entry, index) => <em key={`${entry.name}-${index}`}>{index + 1}. {entry.name}</em>)}</span></article>)}</div>
    </section>
    {(recommendation.missingItems.length > 0 || recommendation.substitutions.length > 0) && <section className={styles.assemblyIssues}>
      <h3><AlertTriangle /> Assembly changes</h3>
      {recommendation.missingItems.map((item) => <p key={`missing-${item}`}><b>Missing</b> {item}</p>)}
      {recommendation.substitutions.map((item) => <p key={`sub-${item}`}><b>Substitute</b> {item}</p>)}
    </section>}
    <div className={styles.detailColumns}>
      <section><h3><Sparkles /> Gameplay loop</h3><ol>{recommendation.gameplayLoop.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <section><h3><Swords /> Damage rotation</h3><ol>{recommendation.damageRotation.map((step) => <li key={step}>{step}</li>)}</ol></section>
    </div>
    <details className={styles.notes}><summary>Notes, limits, and upgrades <ChevronDown /></summary>
      <div><h4>Inventory notes</h4>{recommendation.notes.map((note) => <p key={note}>{note}</p>)}</div>
      <div><h4>Limitations</h4>{recommendation.limitations.map((note) => <p key={note}>{note}</p>)}</div>
      <div><h4>Next upgrades</h4>{recommendation.upgrades.map((note) => <p key={note}>{note}</p>)}</div>
    </details>
    <footer>
      <span><b>Artifact dependence: {recommendation.artifactDependency}</b><small>Reviewed {new Date(`${recommendation.reviewedAt}T00:00:00`).toLocaleDateString()} · {recommendation.release}</small></span>
      <button type="button" disabled={!canOpenBuilder} title={canOpenBuilder ? "Open this recommendation in Builder" : "Build saving is limited to approved Builder editors."} onClick={onOpenBuilder}>Open in Builder <ArrowRight /></button>
    </footer>
  </aside>;
}

function ArmorMatch({ armor }: { armor: BuildAdvisorArmorEvaluation }) {
  const stats = armor.item?.armorStats ? Object.entries(armor.item.armorStats).sort((left, right) => Number(right[1]) - Number(left[1])).slice(0, 3) : [];
  return <article data-quality={armor.quality}>
    {armor.item?.icon ? <img src={armor.item.icon} alt="" /> : <Shield />}
    <span><small>{armor.label}</small><b>{armor.item?.name || "No owned match"}</b><em>{armor.item?.armorArchetype?.name || armor.quality} {armor.item?.armorBaseTotal ? `· ${armor.item.armorBaseTotal} base` : ""}</em></span>
    {armor.item && <strong>{armor.item.power || "—"}</strong>}
    {stats.length > 0 && <p>{stats.map(([stat, value]) => `${stat} ${value}`).join(" · ")}</p>}
  </article>;
}

function WeaponMatch({ weapon }: { weapon: BuildAdvisorWeaponEvaluation }) {
  return <article data-quality={weapon.quality}>
    {weapon.item?.icon ? <img src={weapon.item.icon} alt="" /> : <Crosshair />}
    <span><small>{weapon.label}</small><b>{weapon.item?.name || "No owned match"}</b><em>{weapon.quality} roll · {weapon.substitution} match</em></span>
    {weapon.item && <strong title={weapon.item.crafted ? "Crafted weapon" : undefined}>{weapon.item.crafted ? "◆ " : ""}{weapon.item.power || "—"}</strong>}
    {weapon.matchedPerks.length > 0 && <p>Matched: {weapon.matchedPerks.join(", ")}</p>}
    {weapon.missingPerks.length > 0 && <p>Missing: {weapon.missingPerks.join(", ")}</p>}
  </article>;
}

function PlanEntry({ label, entry }: { label: string; entry?: BuildNamedEntry }) {
  return <article className={styles.planEntry}>{entry?.icon ? <img src={entry.icon} alt="" /> : <Sparkles />}<span><small>{label}</small><b>{entry?.name || "Not configured"}</b>{entry?.description && <em>{entry.description}</em>}</span></article>;
}

function PlanGroup({ title, entries }: { title: string; entries: BuildNamedEntry[] }) {
  return <div className={styles.planGroup}><b>{title}</b><div>{entries.map((entry) => <PlanEntry key={entry.name} label={entry.itemType || title.slice(0, -1)} entry={entry} />)}</div></div>;
}

function armorSlotLabel(slot: keyof BuildArmorMods): string {
  return slot === "classItem" ? "Class item" : slot[0]!.toUpperCase() + slot.slice(1);
}

function InventoryAnalysis({ data }: { data: BuildAdvisorData }) {
  const armorGroups = Object.entries(data.analysis.ownedExoticArmorByClass);
  return <details className={styles.inventory}>
    <summary><span><Boxes /><b>Inventory analysis</b><small>{data.analysis.physicalItemCount} physical gear instances · {data.analysis.savedLoadoutCount} saved loadouts</small></span><ChevronDown /></summary>
    <div className={styles.inventoryBody}>
      {data.analysis.warnings.length > 0 && <section className={styles.inventoryWarnings}><h3>Data completeness</h3>{data.analysis.warnings.map((warning) => <p key={warning}><AlertTriangle /> {warning}</p>)}</section>}
      <section><h3>Owned exotic armor</h3>{armorGroups.length ? armorGroups.map(([className, items]) => <ItemGroup key={className} title={className} items={items || []} />) : <p className={styles.none}>No physical exotic armor detected.</p>}</section>
      <section><h3>Owned exotic weapons</h3><ItemStrip items={data.analysis.ownedExoticWeapons} empty="No physical exotic weapons detected." /></section>
      <section><h3><Vault /> Vault exotics</h3><ItemStrip items={data.analysis.vaultExotics} empty="No exotics detected in the Vault." /></section>
      <section><h3>Collection-only exotics</h3>{data.analysis.collectionOnlyExotics.length ? <div className={styles.collectionItems}>{data.analysis.collectionOnlyExotics.map((item) => <span key={`${item.itemHash}-${item.name}`}>{item.icon && <img src={item.icon} alt="" />}<b>{item.name}</b><small>{item.className || item.itemType}</small></span>)}</div> : <p className={styles.none}>No collection-only exotics detected.</p>}</section>
      <section><h3>Relevant legendary rolls</h3>{data.analysis.relevantLegendaryRolls.length ? <div className={styles.rollTable}>{data.analysis.relevantLegendaryRolls.map((roll) => <span key={`${roll.requirementId}-${roll.item?.instanceId}`}><b>{roll.item?.name}</b><small>{roll.label}</small><em data-quality={roll.quality}>{roll.quality}</em></span>)}</div> : <p className={styles.none}>No relevant legendary roll matches detected.</p>}</section>
      <section><h3>Missing high-impact items</h3>{data.analysis.missingHighImpactItems.length ? <div className={styles.missingList}>{data.analysis.missingHighImpactItems.map((item) => <span key={item}>{item}</span>)}</div> : <p className={styles.none}>No high-impact template items are missing.</p>}</section>
    </div>
  </details>;
}

function ItemGroup({ title, items }: { title: string; items: BuildAdvisorOwnedItem[] }) {
  return <div className={styles.itemGroup}><h4>{title}</h4><ItemStrip items={items} empty="" /></div>;
}

function ItemStrip({ items, empty }: { items: BuildAdvisorOwnedItem[]; empty: string }) {
  if (!items.length) return empty ? <p className={styles.none}>{empty}</p> : null;
  return <div className={styles.itemStrip}>{items.map((item) => <span key={item.instanceId}>{item.icon ? <img src={item.icon} alt="" /> : <Shield />}<b>{item.name}</b><small>{item.location}{item.power ? ` · ${item.power}` : ""}</small>{item.equipped && <em><CheckCircle2 /> Equipped</em>}</span>)}</div>;
}

function stateLabel(state: BuildAdvisorData["state"]): string {
  return state === "current" ? "Inventory current"
    : state === "may-be-stale" ? "Inventory may be stale"
      : state === "sync-required" ? "Bungie sync required"
        : "Inventory data incomplete";
}
