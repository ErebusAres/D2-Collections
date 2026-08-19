import type {
  BuildAdvisorArmorEvaluation,
  BuildAdvisorAcquisitionPlan,
  BuildAdvisorAlternativeSuggestion,
  BuildAdvisorAssemblyStatus,
  BuildAdvisorCategory,
  BuildAdvisorData,
  BuildAdvisorComponentState,
  BuildAdvisorComponentVerification,
  BuildAdvisorFocus,
  BuildAdvisorMissingItemGuide,
  BuildAdvisorOwnedItem,
  BuildAdvisorRecommendation,
  BuildAdvisorWeaponEvaluation,
  BuildArmorMods,
  BuildNamedEntry,
  BuildSubclass,
  EquipBuildAdvisorResult
} from "@guardian-nexus/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Crosshair,
  ExternalLink,
  Gauge,
  LoaderCircle,
  MapPin,
  Puzzle,
  Radar,
  RefreshCw,
  ScanSearch,
  Shield,
  Sparkles,
  Swords,
  Vault
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import { parseWatchlist } from "../modules/watchlists/watchlists";
import { storeAdvisorBuildImport } from "../modules/builds/advisorBuildImport";
import { buildTrackingItem, parseTrackedBuilds } from "../modules/buildAdvisor/buildTracking";
import { api } from "../services/api/client";
import styles from "./BuildAdvisorPage.module.css";

const STATUS_LABELS: Record<BuildAdvisorAssemblyStatus, string> = {
  "fully-assembleable": "Ready now",
  "assembleable-with-substitutions": "Ready with substitutions",
  "missing-one-important-item": "Missing one important item",
  "missing-several-core-items": "Missing several core items",
  "not-viable": "Not viable"
};

const COMPONENT_STATE_LABELS: Record<BuildAdvisorComponentState, string> = {
  "exact-owned": "Exact owned",
  "strong-owned": "Strong owned",
  "functional-owned": "Functional owned",
  "configuration-needed": "Configuration needed",
  "collection-only": "Collections only",
  "owned-other-character": "Owned elsewhere",
  missing: "Missing",
  unavailable: "Unavailable",
  unknown: "Unable to verify"
};

export function BuildAdvisorPage() {
  return <AuthGate><BuildAdvisor /></AuthGate>;
}

function BuildAdvisor() {
  const { session, selectedCharacterId, selectCharacter, preferences = {}, setPreference = () => undefined } = useGuardian();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const forceNext = useRef(false);
  const [category, setCategory] = useState<BuildAdvisorCategory | "All">("All");
  const [subclass, setSubclass] = useState<BuildSubclass | "All">("All");
  const [focus, setFocus] = useState<BuildAdvisorFocus | "All">("All");
  const [activity, setActivity] = useState("All");
  const [complexity, setComplexity] = useState<"All" | BuildAdvisorRecommendation["complexity"]>("All");
  const [assembly, setAssembly] = useState<"All" | "ready" | "substitutions" | "missing">("All");
  const [selectedId, setSelectedId] = useState("");
  const [equipMessage, setEquipMessage] = useState("");
  const result = useQuery({
    queryKey: ["build-advisor", selectedCharacterId],
    queryFn: () => {
      const force = forceNext.current;
      forceNext.current = false;
      return api<BuildAdvisorData>(`/api/v1/me/build-advisor?characterId=${encodeURIComponent(selectedCharacterId)}${force ? "&refresh=1" : ""}`);
    },
    enabled: Boolean(session?.authenticated && selectedCharacterId),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false
  });
  const equipBuild = useMutation({
    mutationFn: (recommendation: BuildAdvisorRecommendation) => api<EquipBuildAdvisorResult>("/api/v1/me/build-advisor/equip", {
      method: "POST",
      body: JSON.stringify({ recommendationId: recommendation.id, characterId: selectedCharacterId })
    }),
    onSuccess: async (response) => {
      setEquipMessage(`${response.data.equippedItemIds.length} build items equipped${response.data.transferredItemIds.length ? ` after moving ${response.data.transferredItemIds.length}` : ""}.`);
      forceNext.current = true;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gear"] }),
        queryClient.invalidateQueries({ queryKey: ["loadouts"] }),
        queryClient.invalidateQueries({ queryKey: ["power"] })
      ]);
      await result.refetch();
    },
    onError: (error: Error) => setEquipMessage(error.message)
  });
  const data = result.data?.data;
  const categories = useMemo(() => [...new Set(data?.recommendations.flatMap((recommendation) => recommendation.categories) || [])], [data?.recommendations]);
  const subclasses = useMemo(() => [...new Set(data?.recommendations.map((recommendation) => recommendation.subclass) || [])], [data?.recommendations]);
  const focuses = useMemo(() => [...new Set(data?.recommendations.flatMap((recommendation) => recommendation.focuses) || [])], [data?.recommendations]);
  const activities = useMemo(() => [...new Set(data?.recommendations.flatMap((recommendation) => recommendation.activities) || [])].sort(), [data?.recommendations]);
  const recommendations = useMemo(() => data?.recommendations.filter((recommendation) =>
    (category === "All" || recommendation.categories.includes(category))
    && (subclass === "All" || recommendation.subclass === subclass)
    && (focus === "All" || recommendation.focuses.includes(focus))
    && (activity === "All" || recommendation.activities.includes(activity))
    && (complexity === "All" || recommendation.complexity === complexity)
    && (assembly === "All"
      || assembly === "ready" && recommendation.status === "fully-assembleable"
      || assembly === "substitutions" && recommendation.status === "assembleable-with-substitutions"
      || assembly === "missing" && ["missing-one-important-item", "missing-several-core-items"].includes(recommendation.status))
  ) || [], [activity, assembly, category, complexity, data?.recommendations, focus, subclass]);
  const recommendationGroups = useMemo(() => subclasses
    .map((entry) => ({ subclass: entry, recommendations: recommendations.filter((recommendation) => recommendation.subclass === entry) }))
    .filter((group) => group.recommendations.length > 0), [recommendations, subclasses]);
  const minimumPathsPerSubclass = data?.recommendations.length && subclasses.length
    ? Math.min(...subclasses.map((entry) => data.recommendations.filter((recommendation) => recommendation.subclass === entry).length))
    : 0;
  const filtersActive = Boolean(data && recommendations.length !== data.recommendations.length);
  const selected = recommendations.find((recommendation) => recommendation.id === selectedId) || recommendations[0];
  const warning = result.data?.warnings[0] || data?.analysis.warnings[0];
  const trackedAcquisitions = useMemo(() => stringSetPreference(preferences["watchlists.buildAcquisitions"]), [preferences]);
  const trackedBuilds = useMemo(() => parseTrackedBuilds(preferences["buildAdvisor.trackedBuilds.v1"]), [preferences]);
  useEffect(() => {
    if (!data?.recommendations.length || !trackedBuilds.length) return;
    let changed = false;
    const next = trackedBuilds.map((item) => {
      const recommendation = data.recommendations.find((entry) => entry.templateId === item.id);
      if (!recommendation) return item;
      const refreshed = buildTrackingItem(recommendation, item.updatedAt);
      if (JSON.stringify(refreshed) === JSON.stringify(item)) return item;
      changed = true;
      return buildTrackingItem(recommendation);
    });
    if (changed) setPreference("buildAdvisor.trackedBuilds.v1", JSON.stringify(next));
  }, [data?.recommendations, setPreference, trackedBuilds]);

  const refreshInventory = async () => {
    forceNext.current = true;
    await result.refetch();
  };
  const openInBuilder = (recommendation: BuildAdvisorRecommendation) => {
    const token = storeAdvisorBuildImport({ sourceName: `Build Advisor · ${recommendation.name}`, document: recommendation.build });
    navigate(`/builds/new?fromAdvisor=${encodeURIComponent(token)}`);
  };
  const equipRecommendation = (recommendation: BuildAdvisorRecommendation) => {
    const plan = recommendation.equipPlan;
    if (!plan.canEquip) return;
    const moving = plan.transferCount ? ` This will move ${plan.transferCount} item${plan.transferCount === 1 ? "" : "s"} to the selected character first.` : "";
    if (!window.confirm(`Equip the ${plan.itemCount} physical gear items for ${recommendation.name}?${moving}`)) return;
    setEquipMessage("");
    equipBuild.mutate(recommendation);
  };
  const toggleAcquisition = (plan: BuildAdvisorAcquisitionPlan) => {
    const trackingKey = plan.trackingKey;
    const next = new Set(trackedAcquisitions);
    const adding = !next.has(trackingKey);
    if (!adding) next.delete(trackingKey); else next.add(trackingKey);
    setPreference("watchlists.buildAcquisitions", JSON.stringify([...next]));
    const watchlist = parseWatchlist(preferences["watchlists.v1"]);
    const id = `build-plan:${trackingKey}`;
    const entries = adding
      ? [...watchlist.entries.filter((entry) => entry.id !== id), { id, kind: "item" as const, label: plan.name, target: plan.name, notes: "Added from Build Advisor farming targets.", enabled: true, notify: true, resetAware: plan.routes.some((route) => Boolean(route.resetAt)), expiresAt: plan.routes.find((route) => route.resetAt)?.resetAt, createdAt: new Date().toISOString() }]
      : watchlist.entries.filter((entry) => entry.id !== id);
    setPreference("watchlists.v1", JSON.stringify({ schemaVersion: 1, entries }));
  };
  const toggleBuildTracking = (recommendation: BuildAdvisorRecommendation) => {
    const alreadyTracked = trackedBuilds.some((item) => item.id === recommendation.templateId);
    const next = alreadyTracked
      ? trackedBuilds.filter((item) => item.id !== recommendation.templateId)
      : [...trackedBuilds.filter((item) => item.id !== recommendation.templateId), buildTrackingItem(recommendation)].slice(-8);
    while (next.length > 1 && JSON.stringify(next).length > 11_500) next.shift();
    setPreference("buildAdvisor.trackedBuilds.v1", JSON.stringify(next));
  };
  const showAllBuilds = () => {
    setCategory("All");
    setSubclass("All");
    setFocus("All");
    setActivity("All");
    setComplexity("All");
    setAssembly("All");
  };

  return <>
    <PageHeader
      eyebrow="Owned gear intelligence"
      title="Build Advisor"
      description="Builds assembled from this Guardian's Vault and all character inventories."
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
        <section className={styles.catalogBanner}><Sparkles /><div><span>Build Advisor 2.0 · Template set v{data.templateSetVersion}</span><strong>{data.recommendations.length} visible {data.characterClass} build paths across {subclasses.length} subclasses</strong><p>Every subclass has at least {minimumPathsPerSubclass} distinct core-Exotic approaches. Missing equipment lowers readiness and adds acquisition steps; it never hides the build.</p></div></section>
        <section className={styles.buildFilters} aria-label="Build recommendation filters">
          <label><span>Subclass</span><select aria-label="Subclass" value={subclass} onChange={(event) => setSubclass(event.target.value as BuildSubclass | "All")}>
            <option value="All">All subclasses</option>
            {subclasses.map((entry) => <option key={entry} value={entry}>{subclassLabel(entry)}</option>)}
          </select></label>
          <label><span>Focus</span><select aria-label="Focus" value={focus} onChange={(event) => setFocus(event.target.value as BuildAdvisorFocus | "All")}>
            <option value="All">All focuses</option>
            {focuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select></label>
          <label><span>Activity</span><select aria-label="Activity" value={activity} onChange={(event) => setActivity(event.target.value)}><option value="All">All activities</option>{activities.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
          <label><span>Complexity</span><select aria-label="Complexity" value={complexity} onChange={(event) => setComplexity(event.target.value as typeof complexity)}><option value="All">Any complexity</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <label><span>Ownership</span><select aria-label="Ownership" value={assembly} onChange={(event) => setAssembly(event.target.value as typeof assembly)}><option value="All">Any readiness</option><option value="ready">Ready now</option><option value="substitutions">Ready with substitutions</option><option value="missing">Missing equipment</option></select></label>
          <div className={styles.filterCount}><span><b>{recommendations.length}</b><small> of {data.recommendations.length} builds shown</small></span>{filtersActive && <button type="button" onClick={showAllBuilds}>Show all {data.recommendations.length}</button>}</div>
        </section>
        <nav className={styles.filters} aria-label="Recommendation categories">
          <button type="button" data-active={category === "All"} onClick={() => setCategory("All")}>All recommendations</button>
          {categories.map((entry) => <button key={entry} type="button" data-active={category === entry} onClick={() => setCategory(entry)}>{entry}</button>)}
        </nav>
        {recommendations.length > 0 ? <div className={styles.workspace}>
          <section className={styles.cardGrid} aria-label="Build recommendations">
            {recommendationGroups.map((group) => <section className={styles.subclassGroup} key={group.subclass} aria-labelledby={`advisor-${group.subclass}`}>
              <header><span>{group.recommendations.length}</span><div><small>Subclass build paths</small><h2 id={`advisor-${group.subclass}`}>{subclassLabel(group.subclass)}</h2></div></header>
              <div>{group.recommendations.map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} selected={selected?.id === recommendation.id} onSelect={() => setSelectedId(recommendation.id)} />)}</div>
            </section>)}
          </section>
          {selected && <RecommendationDetail
            recommendation={selected}
            canOpenBuilder={Boolean(session?.roles.buildEditor)}
            onOpenBuilder={() => openInBuilder(selected)}
            onEquip={() => equipRecommendation(selected)}
            equipping={equipBuild.isPending}
            equipMessage={equipMessage}
            trackedAcquisitions={trackedAcquisitions}
            onToggleAcquisition={toggleAcquisition}
            buildTracked={trackedBuilds.some((item) => item.id === selected.templateId)}
            onToggleBuildTracking={() => toggleBuildTracking(selected)}
          />}
        </div> : <section className={styles.empty}><ScanSearch /><h2>No owned-gear match for these filters</h2><p>Choose another subclass, focus, or recommendation category.</p></section>}
      </> : <section className={styles.empty}><ScanSearch /><h2>No strong near-complete build found</h2><p>Open inventory analysis to see which core pieces are missing, then refresh after your inventory changes.</p></section>}
      <InventoryAnalysis data={data} />
    </>}
  </>;
}

function RecommendationCard({ recommendation, selected, onSelect }: { recommendation: BuildAdvisorRecommendation; selected: boolean; onSelect: () => void }) {
  const armor = recommendation.coreExoticArmor;
  const viabilityScore = recommendation.viabilityScore ?? recommendation.score;
  const readinessScore = recommendation.readinessScore ?? recommendation.score;
  const visibleCategories = recommendation.categories.slice(0, 3);
  const hiddenCategoryCount = recommendation.categories.length - visibleCategories.length;
  return <button type="button" className={styles.card} data-selected={selected} data-status={recommendation.status} onClick={onSelect}>
    <header>
      <div className={styles.score} style={{ "--score": viabilityScore } as React.CSSProperties} aria-label={`Build viability ${viabilityScore} out of 100`}><strong>{viabilityScore}</strong><small>viability</small></div>
      <div><span>{recommendation.classType} · {recommendation.subclass}</span><h2>{recommendation.name}</h2></div>
    </header>
    <div className={styles.readiness}>
      <span><span><i /><strong>{STATUS_LABELS[recommendation.status]}</strong></span><b>{readinessScore}% ready</b></span>
      <i><span style={{ width: `${readinessScore}%` }} /></i>
    </div>
    <p>{recommendation.reason}</p>
    <div className={styles.coreItem}>{armor.icon ? <img src={armor.icon} alt="" /> : <Shield />}<span><small>Core exotic</small><b>{armor.name}</b></span></div>
    <div className={styles.cardMetrics}><span><Swords /> Damage <b>{recommendation.damageProfile}</b></span><span><Shield /> Survival <b>{recommendation.survivability}</b></span><span><Gauge /> Complexity <b>{recommendation.complexity}</b></span></div>
    <footer>
      <span>{recommendation.verification.state === "verified-current" ? "Current sandbox verified" : "Current community build"}</span>
      {recommendation.source.label.startsWith("Account-generated") && <span>Adaptive to your gear</span>}
      {visibleCategories.map((entry) => <span key={entry}>{entry}</span>)}
      {hiddenCategoryCount > 0 && <span title={recommendation.categories.slice(3).join(", ")}>+{hiddenCategoryCount} more</span>}
    </footer>
  </button>;
}

function RecommendationDetail({
  recommendation,
  canOpenBuilder,
  onOpenBuilder,
  onEquip,
  equipping,
  equipMessage,
  trackedAcquisitions,
  onToggleAcquisition,
  buildTracked,
  onToggleBuildTracking
}: {
  recommendation: BuildAdvisorRecommendation;
  canOpenBuilder: boolean;
  onOpenBuilder: () => void;
  onEquip: () => void;
  equipping: boolean;
  equipMessage: string;
  trackedAcquisitions: ReadonlySet<string>;
  onToggleAcquisition: (plan: BuildAdvisorAcquisitionPlan) => void;
  buildTracked: boolean;
  onToggleBuildTracking: () => void;
}) {
  const build = recommendation.build;
  const viabilityScore = recommendation.viabilityScore ?? recommendation.score;
  const readinessScore = recommendation.readinessScore ?? recommendation.score;
  const missingItemGuides = recommendation.missingItemGuides || [];
  const equipPlan = recommendation.equipPlan;
  const abilities: Array<[string, BuildNamedEntry | undefined]> = [
    ["Super", build.subclassConfig.super],
    ...(build.subclass === "prismatic" ? [["Transcendence", build.subclassConfig.transcendence] as [string, BuildNamedEntry | undefined]] : []),
    ["Class ability", build.subclassConfig.classAbility],
    ["Movement", build.subclassConfig.movement],
    ["Melee", build.subclassConfig.melee],
    ["Grenade", build.subclassConfig.grenade]
  ];
  return <aside className={styles.detail} aria-label="Selected build details" tabIndex={0}>
    <header>
      <span>{recommendation.source.label}</span>
      <h2>{recommendation.name}</h2>
      <p>{recommendation.style}</p>
      <div className={styles.verification}>
        <CheckCircle2 />
        <span><b>{recommendation.verification.sandbox}</b><small>Verified {new Date(`${recommendation.verification.verifiedAt}T00:00:00`).toLocaleDateString()}</small></span>
        {recommendation.verification.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label} <ExternalLink /></a>)}
      </div>
      {recommendation.source.kind === "published-build" && <div className={styles.sourceLine}>
        <b>{recommendation.source.authorDisplayName}</b>
        {recommendation.source.rating && <small>{recommendation.source.rating.upvotes} up · {recommendation.source.rating.downvotes} down</small>}
        {recommendation.source.buildSlug && <a href={`/builds/${encodeURIComponent(recommendation.source.buildSlug)}`}>View published build <ExternalLink /></a>}
      </div>}
    </header>
    <section className={styles.scoreSummary} aria-label="Build recommendation scores">
      <article><span>Build viability</span><strong>{viabilityScore}</strong><small>Template strength independent of your inventory</small></article>
      <article><span>Your readiness</span><strong>{readinessScore}%</strong><small>Owned gear, compatible rolls, and substitutions</small></article>
      <article><span>Overall match</span><strong>{recommendation.score}</strong><small>Used to order recommendations for this Guardian</small></article>
    </section>
    <section className={styles.factorList}><h3><Gauge /> Score factors</h3>{recommendation.factors.map((factor) => <div key={factor.id}><span><b>{factor.label}</b><small>{factor.detail}</small></span><em>{factor.earned}/{factor.available}</em><i><span style={{ width: `${factor.available ? factor.earned / factor.available * 100 : 0}%` }} /></i></div>)}</section>
    <section><h3><Shield /> Five-piece armor plan</h3><div className={styles.armorList}>{recommendation.armor.map((entry) => <ArmorMatch key={entry.slot} armor={entry} />)}</div></section>
    {recommendation.armorOptimization && <section className={styles.optimizerSummary}>
      <h3><Gauge /> Account-wide armor optimizer</h3>
      <div className={styles.optimizerMetrics}><span><small>Combinations checked</small><strong>{recommendation.armorOptimization.candidatesEvaluated.toLocaleString()}</strong></span><span><small>Selected score</small><strong>{recommendation.armorOptimization.selected.score}</strong></span><span><small>Alternatives retained</small><strong>{recommendation.armorOptimization.alternatives.length}</strong></span></div>
      <div className={styles.optimizerTargets}>{recommendation.armorOptimization.selected.targets.map((target) => <span key={target.stat} data-met={target.met}><b>{target.stat}</b><strong>{target.actual}{target.target !== undefined ? ` / ${target.target}` : ""}</strong></span>)}</div>
      {recommendation.armorOptimization.selected.setBonuses.length > 0 && <p>{recommendation.armorOptimization.selected.setBonuses.map((set) => `${set.name} ${set.pieces}-piece`).join(" · ")}</p>}
    </section>}
    <section><h3><Crosshair /> Three-weapon loadout</h3><div className={styles.weaponList}>{recommendation.weapons.map((weapon) => <WeaponMatch key={weapon.requirementId} weapon={weapon} />)}</div></section>
    <section className={styles.subclassPlan}>
      <h3><Sparkles /> {build.subclass} subclass configuration</h3>
      <p className={styles.compatibility} data-state={recommendation.subclassValidation.state}>
        {recommendation.subclassValidation.state === "validated" ? <CheckCircle2 /> : <AlertTriangle />}
        {recommendation.subclassValidation.message}
      </p>
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
      {missingItemGuides.length > 0
        ? <div className={styles.acquisitionGuides}>{missingItemGuides.map((guide) => <AcquisitionGuide key={guide.id} guide={guide} />)}</div>
        : recommendation.missingItems.map((item) => <p key={`missing-${item}`}><b>Missing</b> {item}</p>)}
      {recommendation.substitutions.length > 0 && <div className={styles.substitutions}>{recommendation.substitutions.map((item) => <p key={`sub-${item}`}><b>Substitute</b> {item}</p>)}</div>}
    </section>}
    {recommendation.componentVerifications?.length ? <section className={styles.componentTruth}>
      <h3><CheckCircle2 /> Account verification</h3>
      <p>Physical ownership, Collections unlocks, substitutions, and unavailable Bungie data remain separate states.</p>
      <div>{recommendation.componentVerifications.map((component) => <ComponentVerification key={component.id} component={component} />)}</div>
    </section> : null}
    {recommendation.alternatives?.length ? <section className={styles.alternativePlan}>
      <h3><RefreshCw /> Owned alternatives</h3>
      <p>Ranked fallbacks preserve the build role and show what changes.</p>
      <div>{recommendation.alternatives.map((alternative) => <AlternativeSuggestion key={alternative.id} alternative={alternative} />)}</div>
    </section> : null}
    {recommendation.acquisitionPlans?.length ? <section className={styles.farmingPlans}>
      <h3><MapPin /> Farming targets</h3>
      <div>{recommendation.acquisitionPlans.map((plan) => <FarmingPlan key={plan.id} plan={plan} tracked={trackedAcquisitions.has(plan.trackingKey)} onToggle={() => onToggleAcquisition(plan)} />)}</div>
    </section> : null}
    {recommendation.upgradePath?.length ? <section className={styles.upgradePath}>
      <h3><Gauge /> Build progression</h3>
      <div>{recommendation.upgradePath.map((stage, index) => <article key={stage.id} data-kind={stage.kind}><i>{index + 1}</i><span><small>{stage.kind.replace(/-/g, " ")}</small><b>{stage.title}</b><p>{stage.description}</p></span><strong>{stage.readinessTarget}%</strong></article>)}</div>
    </section> : null}
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
      <span>
        <b>Artifact dependence: {recommendation.artifactDependency}</b>
        <small>Reviewed {new Date(`${recommendation.reviewedAt}T00:00:00`).toLocaleDateString()} · {recommendation.release}</small>
        <small>{equipPlan.blockers[0] || (equipPlan.state === "already-equipped" ? "All selected gear is already equipped." : `${equipPlan.itemCount} items ready${equipPlan.transferCount ? ` · ${equipPlan.transferCount} will move first` : ""}.`)}</small>
        <small>Equips physical gear; subclass sockets and mods remain the plan above.</small>
        {equipMessage && <em className={styles.equipMessage} role="status">{equipMessage}</em>}
      </span>
      <div className={styles.detailActions}>
        <button type="button" data-active={buildTracked} onClick={onToggleBuildTracking}><Bookmark />{buildTracked ? "Tracked on Fireteam" : "Track build on Fireteam"}</button>
        <button
          type="button"
          className={styles.equipButton}
          disabled={!equipPlan.canEquip || equipping}
          title={equipPlan.canEquip ? "Move and equip the selected physical gear through Bungie" : equipPlan.blockers[0] || "This gear is already equipped."}
          onClick={onEquip}
        >
          {equipping ? <LoaderCircle className={styles.spin} /> : <Swords />}
          {equipping ? "Equipping…" : equipPlan.state === "already-equipped" ? "Already equipped" : "Equip build gear"}
        </button>
        <button type="button" disabled={!canOpenBuilder} title={canOpenBuilder ? "Open this recommendation in Builder" : "Build saving is limited to approved Builder editors."} onClick={onOpenBuilder}>Open in Builder <ArrowRight /></button>
      </div>
    </footer>
  </aside>;
}

function ComponentVerification({ component }: { component: BuildAdvisorComponentVerification }) {
  return <article data-state={component.state}>
    {component.item?.icon ? <img src={component.item.icon} alt="" /> : component.state === "missing" || component.state === "unknown" ? <CircleHelp /> : <CheckCircle2 />}
    <span><small>{component.kind.replace(/-/g, " ")}</small><b>{component.name}</b><em>{component.reasons[0]}</em></span>
    <strong>{COMPONENT_STATE_LABELS[component.state]}</strong>
    {component.actions[0] && <p>{component.actions[0]}</p>}
  </article>;
}

function AlternativeSuggestion({ alternative }: { alternative: BuildAdvisorAlternativeSuggestion }) {
  return <article data-tier={alternative.tier}>
    {alternative.item?.icon ? <img src={alternative.item.icon} alt="" /> : <RefreshCw />}
    <span><small>{alternative.kind} · {alternative.tier}</small><b>{alternative.name}</b><em>{alternative.benefits[0]}</em></span>
    <strong>{alternative.score}</strong>
    {(alternative.matchedTraits.length > 0 || alternative.missingTraits.length > 0) && <p>{alternative.matchedTraits.length ? `Matches ${alternative.matchedTraits.join(", ")}.` : ""}{alternative.missingTraits.length ? ` Missing ${alternative.missingTraits.join(", ")}.` : ""}</p>}
  </article>;
}

function FarmingPlan({ plan, tracked, onToggle }: { plan: BuildAdvisorAcquisitionPlan; tracked: boolean; onToggle: () => void }) {
  const route = plan.routes[0];
  if (!route) return null;
  return <article>
    <header><span><small>{route.availability} · {route.certainty}</small><b>{plan.name}</b></span><div><strong>{route.source.replace(/-/g, " ")}</strong><button type="button" data-active={tracked} onClick={onToggle}><Bookmark />{tracked ? "Tracked" : "Track farm"}</button></div></header>
    <p>{route.description}</p>
    {(plan.targetTraits.required.length > 0 || plan.targetTraits.preferred.length > 0 || plan.targetTraits.acceptable.length > 0) && <div>
      {plan.targetTraits.required.map((trait) => <em key={`required-${trait}`} data-priority="required">Required · {trait}</em>)}
      {plan.targetTraits.preferred.map((trait) => <em key={`preferred-${trait}`} data-priority="preferred">Preferred · {trait}</em>)}
      {plan.targetTraits.acceptable.map((trait) => <em key={`acceptable-${trait}`}>Fallback · {trait}</em>)}
    </div>}
    <ol>{route.steps.map((step) => <li key={step}>{step}</li>)}</ol>
  </article>;
}

function stringSetPreference(value?: string): Set<string> {
  try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []); }
  catch { return new Set(); }
}

function AcquisitionGuide({ guide }: { guide: BuildAdvisorMissingItemGuide }) {
  return <article data-source={guide.source}>
    <header>
      {guide.icon ? <img src={guide.icon} alt="" /> : <MapPin />}
      <span><small>How to obtain</small><b>{guide.name}</b><em>{guide.itemType}</em></span>
      <strong>{guideSourceLabel(guide.source)}</strong>
    </header>
    <p>{guide.acquisition}</p>
    <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
  </article>;
}

function guideSourceLabel(source: BuildAdvisorMissingItemGuide["source"]): string {
  if (source === "collections") return "Collections";
  if (source === "bungie-manifest") return "Bungie manifest";
  return "Build requirement";
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

function subclassLabel(subclass: BuildSubclass): string {
  return subclass[0]!.toUpperCase() + subclass.slice(1);
}
