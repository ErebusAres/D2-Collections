import type { CleanupAnalysis, CleanupAnalyzeData, CleanupSettings, CleanupWorkspaceData, GearActionResult, GearData, GearTag } from "@guardian-nexus/contracts";
import { CLEANUP_DEFAULTS } from "@guardian-nexus/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGuardian } from "../../context/GuardianContext";
import { api, mutationHeaders } from "../../services/api/client";
import { gearLootItems, LootHistoryGrid, type LootItem } from "./RecentLoot";
import styles from "./CleanupWorkspace.module.css";
import { CleanupComparison } from "./CleanupComparison";
import { CleanupSelect } from "./CleanupSelect";
import { CleanupHealthReview } from "./CleanupHealthReview";
import { WEAPON_RATING_SOURCES } from "../../modules/loot/weaponEvaluator";
import { cleanupAnalysisSettingsKey, cleanupSettingsKey, manualJunkItems, updateCleanupCache } from "./cleanupState";
import { CheckCircle2, ScanSearch, ShieldCheck, SlidersHorizontal, Sparkles, Tags, Trash2, Undo2 } from "lucide-react";
import { CleanupApprovalControl } from "./CleanupApprovalControl";
import { CleanupAnalysisStatus } from "./CleanupAnalysisStatus";

export function CleanupWorkspace({ gear, onTag, tagBusy = false, analysisRequest = 0 }: { gear: GearData; onTag: (item: LootItem, tag?: GearTag) => void; tagBusy?: boolean; analysisRequest?: number }) {
  const { session, selectedCharacterId } = useGuardian(); const client = useQueryClient();
  const stored = useQuery({ queryKey: ["cleanup-state", session?.guardian?.membershipId], queryFn: () => api<CleanupWorkspaceData>("/api/v1/me/cleanup"),
    refetchInterval: (query) => query.state.data?.data.analysisStatus === "refreshing" ? 10_000 : false });
  const [settings, setSettings] = useState<CleanupSettings>(CLEANUP_DEFAULTS);
  const [analysis, setAnalysis] = useState<CleanupAnalysis>(); const [selected, setSelected] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(0); const [onlyMarked, setOnlyMarked] = useState(false); const [comparisonId, setComparisonId] = useState(""); const [lastBatch, setLastBatch] = useState("");
  const [notice, setNotice] = useState("");
  const initialized = useRef(false);
  const loadedSavedVersion = useRef("");
  useEffect(() => {
    if (!stored.data) return;
    if (!initialized.current) { initialized.current = true; setSettings(stored.data.data.settings); }
    if (stored.data.data.savedAnalysis && loadedSavedVersion.current !== stored.data.data.savedAnalysis.version) {
      loadedSavedVersion.current = stored.data.data.savedAnalysis.version;
      setAnalysis(stored.data.data.savedAnalysis);
    }
  }, [stored.data]);
  const scan = useMutation({ mutationFn: (requestedSettings?: CleanupSettings) => api<CleanupAnalyzeData>("/api/v1/me/cleanup/analyze", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(requestedSettings || settings) }), onSuccess: (result) => {
    if (result.data.analysis) { setAnalysis(result.data.analysis); setSelected([]); setComparisonId(""); }
    setNotice(result.data.status === "current" ? "Cleanup analysis is current." : result.data.analysis ? "Refreshing cleanup in the background; the last complete recommendations remain available." : "Cleanup analysis is queued. You can leave this page while it finishes.");
    void client.invalidateQueries({ queryKey: ["cleanup-state", session?.guardian?.membershipId] });
  } });
  const handledRequest = useRef(0);
  useEffect(() => {
    if (stored.data && analysisRequest > handledRequest.current) { handledRequest.current = analysisRequest; scan.mutate(stored.data.data.settings); }
  }, [analysisRequest, stored.data, scan.mutate]);
  const changes = useMutation({ mutationFn: (input: { action: "approve" | "dismiss" | "undo"; itemIds?: string[]; batchId?: string }) => api<{ batchId: string; undone?: boolean; itemIds?: string[]; marks: CleanupAnalysis["marks"]; cosmeticItems: string[] }>("/api/v1/me/cleanup", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ ...input, batchId: input.batchId || crypto.randomUUID(), settings, version: analysis?.version }) }), onSuccess: (result, input) => {
    const changed = new Set([...Object.keys(marks), ...Object.keys(result.data.marks)]);
    client.setQueryData(["cleanup-state", session?.guardian?.membershipId], { ...stored.data, data: { ...stored.data?.data, settings, marks: result.data.marks } });
    for (const key of ["gear", "recent-items", "fireteam-recent-items"]) {
      client.setQueriesData({ queryKey: [key] }, (value: unknown) => updateCleanupCache(value, result.data.marks, changed));
      void client.invalidateQueries({ queryKey: [key] });
    }
    if (input.action === "approve") setNotice(`${result.data.itemIds?.length || 0} items approved for cleanup. Existing manual tags were preserved.`);
    if (input.action === "approve") setLastBatch(result.data.batchId);
    if (input.action === "undo") { setLastBatch(""); setNotice("Cleanup approval batch undone. Manual tags and appearance were left unchanged."); }
    if (analysis && input.action === "dismiss") setAnalysis({ ...analysis, dismissed: [...analysis.dismissed, ...analysis.recommendations.filter((r) => input.itemIds?.includes(r.itemId)).map((r) => r.key)] });
    setSelected([]); void client.invalidateQueries({ queryKey: ["cleanup-state"] }); void client.invalidateQueries({ queryKey: ["gear"] }); void client.invalidateQueries({ queryKey: ["recent-items"] });
  } });
  const transfer = useMutation({ mutationFn: async (itemId: string) => {
    const result = await api<GearActionResult>("/api/v1/me/cleanup/pull", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ itemId, characterId: selectedCharacterId, settings }) });
    if (result.data.failed.length) throw new Error(result.data.failed[0]!.message);
    return result;
  }, onSuccess: (result) => { setNotice(result.warnings.length ? result.warnings.join(" ") : "Pulled successfully."); void client.invalidateQueries({ queryKey: ["gear"] }); void client.invalidateQueries({ queryKey: ["recent-items"] }); void client.invalidateQueries({ queryKey: ["cleanup-state"] }); void client.invalidateQueries({ queryKey: ["fireteam-recent-items"] }); scan.mutate(undefined); } });
  const restore = useMutation({ mutationFn: (itemId: string) => api<{ restored: boolean }>("/api/v1/me/cleanup/restore", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ itemId }) }), onSuccess: (result) => { void client.invalidateQueries({ queryKey: ["cleanup-state"] }); void client.invalidateQueries({ queryKey: ["gear"] }); void client.invalidateQueries({ queryKey: ["recent-items"] }); void client.invalidateQueries({ queryKey: ["fireteam-recent-items"] }); setNotice(result.warnings.length ? result.warnings.join(" ") : "Original appearance restored."); } });
  const saveAppearance = useMutation({ mutationFn: (value: CleanupSettings) => api<CleanupSettings>("/api/v1/me/cleanup/settings", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(value) }), onSuccess: (result) => {
    client.setQueryData(["cleanup-state", session?.guardian?.membershipId], (current: typeof stored.data) => current ? { ...current, data: { ...current.data, settings: result.data } } : current);
    setNotice(result.data.cosmetics?.enabled ? "Global pull appearance saved and enabled." : "Global pull appearance saved and disabled.");
  } });
  const change = (next: Partial<CleanupSettings>) => { setSettings((s) => ({ ...s, ...next })); setSelected([]); };
  const stale = Boolean(analysis && cleanupAnalysisSettingsKey(settings) !== cleanupAnalysisSettingsKey(analysis.settings));
  const marks = stored.data?.data.marks || analysis?.marks || {};
  const accountItems = gearLootItems(gear.items, gear.weapons || []);
  const manualJunk = manualJunkItems(gear);
  const manualJunkIds = new Set(manualJunk.map((item) => item.instanceId));
  const rows = (analysis?.recommendations || []).filter((r) => !manualJunkIds.has(r.itemId) && !analysis?.dismissed.includes(r.key) && r.confidence >= confidence && (!onlyMarked || marks[r.itemId]));
  const analysisItems: LootItem[] = analysis ? gearLootItems(analysis.gear.items, analysis.gear.weapons || []).map((item) => ({ ...item, cleanupRecommendation: marks[item.instanceId] })) : [];
  const all = [...new Map([...analysisItems, ...accountItems].map((item) => [item.instanceId, item])).values()];
  const byId = new Map(all.map((item) => [item.instanceId, item]));
  const comparison = analysis?.recommendations.find((entry) => entry.itemId === comparisonId);
  const cosmeticIcons = Object.fromEntries((analysis?.cosmetics || []).filter((choice) => choice.icon).map((choice) => [choice.hash, [{ icon: choice.icon!, name: choice.name }]]));
  const styleIcons = Object.fromEntries((analysis?.cosmeticSets || []).map((set) => [set.id, Object.values(set.pieces).flatMap((hash) => cosmeticIcons[hash] || [])]));
  const closeComparison = useCallback(() => setComparisonId(""), []);
  const busy = tagBusy || scan.isPending || changes.isPending || transfer.isPending || restore.isPending || saveAppearance.isPending;
  const taggedCount = Object.keys(marks).length;
  const eligibleCount = rows.filter((entry) => entry.actionable && !marks[entry.itemId]).length;
  const protectedCount = rows.filter((entry) => !entry.actionable).length;
  const approvedVisibleCount = rows.filter((entry) => marks[entry.itemId]).length;
  const cosmeticItemIds = new Set(stored.data?.data.cosmeticItems || []);
  const markBatches = [...Object.entries(marks).reduce((batches, [itemId, mark]) => {
    const batch = batches.get(mark.batchId) || [];
    batch.push({ itemId, mark }); batches.set(mark.batchId, batch); return batches;
  }, new Map<string, Array<{ itemId: string; mark: CleanupAnalysis["marks"][string] }>>()).entries()];
  const appearanceOnlyItems = [...cosmeticItemIds].filter((itemId) => !marks[itemId]);
  const operationError = scan.error || changes.error || stored.error || transfer.error || restore.error || saveAppearance.error;
  const appearanceDirty = cleanupSettingsKey(settings.cosmetics || {}) !== cleanupSettingsKey(stored.data?.data.settings.cosmetics || {});
  const exactMode = settings.exact && !settings.dominance && settings.fullComparison === false && settings.legacyReview === false && !settings.preferences;
  const pull = (item: LootItem) => {
    const recommendation = analysis?.recommendations.find((r) => r.itemId === item.instanceId);
    if (item.tag !== "junk" && (stale || !recommendation?.actionable || !marks[item.instanceId])) return;
    transfer.mutate(item.instanceId);
  };
  const candidateState = (itemId: string, actionable: boolean) => marks[itemId] ? "Approved" : actionable ? "Ready" : "Protected";
  return <section className={styles.workspace}>
    <header className={styles.hero}><div><span className={styles.eyebrow}><Sparkles size={13} /> SAFE ACCOUNT REVIEW</span><h2>Gear cleanup</h2><p>Compare what you own, protect useful alternatives, and build a dismantle list you can verify in game.</p></div><div className={styles.safety}><ShieldCheck /><span><strong>Nothing is dismantled here</strong><small>Guardian Nexus only saves private cleanup decisions, moves explicitly requested items, and changes appearances after a separate confirmation.</small></span></div></header>
    <CleanupAnalysisStatus analysis={analysis} status={stored.data?.data.analysisStatus || (scan.isPending ? "refreshing" : undefined)} error={stored.data?.data.analysisError} />
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {operationError && <p className={styles.errorNotice} role="alert">{operationError.message}</p>}
    {stale && <p className={styles.staleNotice} role="status">Rules changed. Run analysis again before approving or pulling recommendations. Manual Junk remains available.</p>}
    {manualJunk.length > 0 && <LootHistoryGrid detailActions itemSummary={() => <small className={styles.manualJunkLabel}><Trash2 size={12} /> Junk</small>} title="Manual junk" subtitle="Your explicit Junk tags · open a card or press P to pull after live safety checks." items={manualJunk} onTag={onTag} onPull={pull} busy={busy} empty="No manually tagged Junk items." itemActions={(item) => <div className={styles.reason}><strong className={styles.manualJunkTitle}>Manually marked Junk</strong><p>This is your own Junk tag, not an analyzer recommendation. Pull it to the selected Guardian for in-game review.</p><button disabled={busy} onClick={() => pull(item)}>Pull [P]</button></div>} />}
    <section className={styles.setup}><header><span><SlidersHorizontal size={16} /><strong>Analysis setup</strong></span><small>Changing a rule requires a fresh analysis before approving recommendations.</small></header>
      <div className={styles.presets}><button data-active={!exactMode} type="button" onClick={() => change({ exact: true, dominance: true, fullComparison: true, legacyReview: true, preferences: true, aggressive: false })}><ScanSearch /><span><strong>Smart cleanup</strong><small>Duplicates, better alternatives, older armor, and trusted rating sources</small></span><CheckCircle2 /></button><button data-active={exactMode} type="button" onClick={() => change({ exact: true, dominance: false, fullComparison: false, legacyReview: false, preferences: false, aggressive: false })}><Tags /><span><strong>Exact duplicates</strong><small>Only identical selectable rolls and matching armor stats</small></span><CheckCircle2 /></button></div>
      <div className={styles.controls}>
        <div className={styles.segments} role="group" aria-label="Activity focus">{(["both", "pve", "pvp"] as const).map((focus) => <button className={styles.segment} type="button" key={focus} aria-pressed={settings.focus === focus} onClick={() => change({ focus })}>{focus === "both" ? "PvE + PvP" : focus === "pve" ? "PvE" : "PvP"}</button>)}</div>
        <label>Candidates<CleanupSelect value={settings.location} onChange={(e) => change({ location: e.target.value as CleanupSettings["location"] })}><option value="vault">Vault only</option><option value="all">All locations</option></CleanupSelect></label>
        <button className={styles.analyze} disabled={busy} onClick={() => scan.mutate(undefined)}><ScanSearch size={15} />{scan.isPending ? "Analyzing…" : analysis ? "Run analysis again" : "Analyze gear"}</button>
      </div>
      <details className={styles.ruleDetails}><summary>Fine-tune comparison rules</summary><div className={styles.ruleCards}><label><input type="checkbox" checked={settings.exact} onChange={(e) => change({ exact: e.target.checked })} /><span>Exact duplicates<small>Match selectable rolls or armor stats</small></span></label><label><input type="checkbox" checked={settings.dominance} onChange={(e) => change({ dominance: e.target.checked })} /><span>Better owned alternatives<small>Require a clearly stronger keeper</small></span></label><label><input type="checkbox" checked={settings.fullComparison !== false} onChange={(e) => change({ fullComparison: e.target.checked })} /><span>Compare across armor names<small>Same class, slot, fit and socket capability</small></span></label><label><input type="checkbox" checked={settings.legacyReview !== false} onChange={(e) => change({ legacyReview: e.target.checked })} /><span>Older armor review<small>Special uses remain review-only</small></span></label><label><input type="checkbox" checked={settings.preferences} onChange={(e) => change({ preferences: e.target.checked })} /><span>Ratings and stat preferences<small>Unknown ratings never count as bad</small></span></label></div></details>
    </section>
    {taggedCount > 0 && <details><summary>Approved cleanup list ({taggedCount})</summary><p>Private Guardian Nexus approvals. Pull one when you are ready to verify it in game.</p><div className={styles.approvedBatches}>{markBatches.map(([batchId, entries]) => <section key={batchId}><div>{entries.map(({ itemId, mark }) => <span key={itemId}><b>{byId.get(itemId)?.name || `Item ${itemId}`}</b><small>{mark.confidence}% · {mark.reason}</small>{cosmeticItemIds.has(itemId) && <button disabled={busy} onClick={() => restore.mutate(itemId)}>Restore appearance</button>}</span>)}</div><button disabled={busy} onClick={() => changes.mutate({ action: "undo", batchId })}><Undo2 size={13} /> Undo this approval batch</button></section>)}</div></details>}
    {appearanceOnlyItems.length > 0 && <details><summary>Saved appearance restores ({appearanceOnlyItems.length})</summary>{appearanceOnlyItems.map((id) => <div key={id}>{byId.get(id)?.name || `Item ${id}`} <button disabled={busy} onClick={() => restore.mutate(id)}>Restore appearance</button></div>)}</details>}
    <details className={styles.advanced}><summary><SlidersHorizontal size={14} /> Advanced rules, sources and protections</summary>
      <p>Locked, equipped, manually tagged, saved-build/loadout, crafted/enhanced, Exotic and highest-Power items are protected. Aggressive mode may show them for review, but cannot tag them.</p>
      <label><input type="checkbox" checked={settings.aggressive} onChange={(e) => change({ aggressive: e.target.checked })} /> Aggressive review</label>
      <div className={styles.controls}>{Object.entries(settings.priorities).map(([stat, weight]) => <label key={stat}>{stat}<CleanupSelect value={weight} onChange={(e) => change({ priorities: { ...settings.priorities, [stat]: Number(e.target.value) } })}><option value={0}>Ignore in preference comparisons</option><option value={1}>Protect this stat</option></CleanupSelect></label>)}</div>
      <p>Ignoring Health is optional, including for PvE. Exact and strict comparisons still consider every stat.</p>
      <p>Sources supplement owned-inventory comparisons when rating and stat preferences are enabled. All selected catalogs must agree; unknown ratings are not negative evidence.</p>
      {WEAPON_RATING_SOURCES.map((source) => <label key={source.id} title={source.note}><input type="checkbox" checked={settings.sources.includes(source.id)} disabled={settings.sources.length === 1 && settings.sources.includes(source.id)} onChange={(e) => change({ sources: e.target.checked ? [...settings.sources, source.id] : settings.sources.filter((id) => id !== source.id) })} />{source.label} · Used by: {source.usedBy}</label>)}
      {analysis?.sources.map((source) => <p key={source.id}>{source.name} · Catalog dated {source.reviewedAt}</p>)}
    </details><details className={styles.advanced}><summary><Sparkles size={14} /> Global pull appearance</summary>
      <h3>Apply a consistent look when gear is pulled</h3>
      <label><input type="checkbox" checked={settings.cosmetics?.enabled || false} onChange={(e) => change({ cosmetics: { ornaments: {}, ...settings.cosmetics, enabled: e.target.checked } })} /> Auto-apply selected shaders and ornaments after any pull to a Guardian</label>
      <p>This applies to Pull buttons and the P shortcut across Gear, Vault, Recent Loot, Fireteam, and Cleanup. Only choices Bungie currently reports as owned and insertable are used. Incompatible choices are skipped, and pulls still succeed.</p>
      {(["weaponShader", "armorShader"] as const).map((key) => <label key={key}>{key === "weaponShader" ? "Weapon shader" : "Armor shader"}<CleanupSelect icons={cosmeticIcons} value={settings.cosmetics?.[key] || ""} onChange={(e) => change({ cosmetics: { enabled: false, ornaments: {}, ...settings.cosmetics, [key]: e.target.value || undefined } })}><option value="">Leave unchanged</option>{[...new Map((analysis?.cosmetics || []).filter((c) => c.kind === "shader" && (key === "weaponShader" ? c.group === "weapons" : c.group !== "weapons")).map((c) => [c.hash, c])).values()].map((c) => <option key={c.hash} value={c.hash}>{c.name}</option>)}</CleanupSelect></label>)}
      <div className={styles.classStyles}>{["Titan", "Hunter", "Warlock"].map((className) => <div className={styles.classStyle} key={className}><h3>{className}</h3><CleanupSelect icons={styleIcons} value={settings.cosmetics?.classStyles?.[className] || ""} onChange={(e) => change({ cosmetics: { enabled: false, ...settings.cosmetics, classStyles: { ...settings.cosmetics?.classStyles, [className]: e.target.value }, ornaments: Object.fromEntries(Object.entries(settings.cosmetics?.ornaments || {}).filter(([group]) => !group.startsWith(`${className}:`))) } })}><option value="">Leave appearance unchanged</option>{analysis?.cosmeticSets?.filter((set) => set.className === className).map((set) => <option key={set.id} value={set.id}>{set.name} · {set.owned}/5 available pieces</option>)}</CleanupSelect><small>One choice covers helmet, arms, chest, legs and class item. Unowned or incompatible pieces are skipped.</small></div>)}</div>
      <button className={styles.primaryAction} disabled={saveAppearance.isPending || !appearanceDirty} onClick={() => saveAppearance.mutate(settings)}>{saveAppearance.isPending ? "Saving…" : appearanceDirty ? "Save global appearance" : "Global appearance saved"}</button>
      <p>For a one-item override, open that item and choose Appearance. Undo tags does not restore an automatically applied look; use Restore appearance after pulling.</p>
      {analysis && !analysis.cosmeticSets?.length && <p>No verified, owned collection styles are available in this snapshot. Analyze again after the game catalog updates. No sets are guessed from similar names.</p>}
      {analysis && !analysis.cosmetics.length && <p>No owned, insertable cosmetic choices were returned for this inventory. Appearance will remain unchanged.</p>}
    </details>
    {analysis && <>
      {settings.focus === "pve" && <CleanupHealthReview items={all} onTag={onTag} />}
      <section className={styles.resultsHeader}><div><span className={styles.eyebrow}>REVIEW RESULTS</span><h3>{rows.length} candidates shown</h3><p>{analysis.coverage?.complete === false ? "Results are still filling in as the remaining saved gear is checked." : `Checked ${new Date(analysis.observedAt).toLocaleString()}.`} Open a tile to see the candidate, keeper, and evidence.</p></div><div className={styles.metrics}><span><strong>{eligibleCount}</strong><small>ready</small></span><span><strong>{protectedCount}</strong><small>protected</small></span><span><strong>{approvedVisibleCount}</strong><small>approved</small></span><span><strong>{rows.length}</strong><small>visible</small></span></div></section>
      <div className={styles.resultControls}>
        <label>Confidence<CleanupSelect value={confidence} onChange={(e) => { setConfidence(Number(e.target.value)); setSelected([]); }}><option value={0}>All recommendations</option><option value={95}>95% and above</option><option value={99}>99% exact comparisons</option></CleanupSelect></label>
        <span className={styles.confidenceHelp} title="Rules-based evidence tiers, not measured probabilities: 99% exact equivalent; 95% strictly better equivalent; 70% preference-based.">ⓘ Rules-based confidence</span>
        <label><input type="checkbox" checked={onlyMarked} onChange={(e) => { setOnlyMarked(e.target.checked); setSelected([]); }} /> Approved only</label>
        <span className={styles.actionSpacer} /><button disabled={busy || stale} onClick={() => setSelected(rows.filter((r) => r.actionable && !marks[r.itemId]).slice(0, 50).map((r) => r.itemId))}>Select ready ({Math.min(eligibleCount, 50)})</button>
        <button className={styles.primaryAction} disabled={busy || stale || !selected.length} onClick={() => changes.mutate({ action: "approve", itemIds: selected })}><Tags size={14} /> Approve selected ({selected.length})</button>
        <button disabled={busy || !lastBatch} onClick={() => changes.mutate({ action: "undo", batchId: lastBatch })}><Undo2 size={14} /> Undo batch</button>
      </div>
      {comparison && byId.has(comparison.itemId) && byId.has(comparison.keeperId) && <CleanupComparison candidate={byId.get(comparison.itemId)!} keeper={byId.get(comparison.keeperId)!} recommendation={comparison} sources={analysis.sources} onClose={closeComparison} />}
      <LootHistoryGrid detailActions itemSummary={(item) => { const r = rows.find((entry) => entry.itemId === item.instanceId)!; return <><small className={styles.recommendedJunkLabel} title={r.reason}><Trash2 size={12} /> {r.confidence}% · {candidateState(item.instanceId, r.actionable)}</small><button type="button" onClick={() => setComparisonId(r.itemId)}>Compare</button></>; }} title="Cleanup candidates" subtitle={eligibleCount ? "Eligible items can be approved here. Protected items remain review-only and explain why." : "Current candidates are protected. Open a tile to see the exact reason and comparison evidence."} items={rows.map((r) => byId.get(r.itemId)).filter((item): item is LootItem => Boolean(item))} onTag={onTag} onPull={pull} busy={busy || stale} empty={analysis.coverage?.complete === false ? "No candidates in the processed batches yet. The list updates as analysis continues." : "No recommendations match these rules. Unique items and protected gear are retained."} itemActions={(item) => {
        const r = rows.find((entry) => entry.itemId === item.instanceId)!;
        return <div className={styles.reason}><strong>{r.confidence}% · {candidateState(item.instanceId, r.actionable)}</strong><p>{r.reason}</p><p>Keeping: {byId.get(r.keeperId)?.name || r.keeperId} · {byId.get(r.keeperId)?.power} Power</p><p>{r.confidence === 70 && item.kind === "weapon" ? `Sources: ${analysis.sources.map((s) => `${s.name} (${s.reviewedAt})`).join(", ")}` : "Source: local comparison of your owned items."}</p>{r.protections.length > 0 && <p>Protected: {r.protections.join(", ")}</p>}<CleanupApprovalControl actionable={r.actionable} tagged={Boolean(marks[item.instanceId])} busy={busy} stale={stale} protections={r.protections} onApprove={() => changes.mutate({ action: "approve", itemIds: [item.instanceId] })} /><button onClick={() => setComparisonId(r.itemId)}>Compare with keeper</button><button disabled={busy || stale} onClick={() => changes.mutate({ action: "dismiss", itemIds: [item.instanceId] })}>Keep / dismiss</button><button disabled={busy || stale || !r.actionable || !marks[item.instanceId]} onClick={() => pull(item)}>Pull [P]</button>{marks[item.instanceId] && <button disabled={busy} onClick={() => changes.mutate({ action: "undo", batchId: marks[item.instanceId]!.batchId })}>Undo this batch</button>}</div>;
      }} />
    </>}
  </section>;
}
