import type { CleanupAnalysis, CleanupSettings, GearActionResult, GearTag } from "@guardian-nexus/contracts";
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
import { cleanupSettingsKey, updateCleanupCache } from "./cleanupState";
import { Trash2 } from "lucide-react";

export function CleanupWorkspace({ onTag, analysisRequest = 0 }: { onTag: (item: LootItem, tag?: GearTag) => void; analysisRequest?: number }) {
  const { session, selectedCharacterId } = useGuardian(); const client = useQueryClient();
  const stored = useQuery({ queryKey: ["cleanup-state", session?.guardian?.membershipId], queryFn: () => api<{ settings: CleanupSettings; marks: CleanupAnalysis["marks"]; cosmeticItems: string[] }>("/api/v1/me/cleanup") });
  const [settings, setSettings] = useState<CleanupSettings>(CLEANUP_DEFAULTS);
  const [analysis, setAnalysis] = useState<CleanupAnalysis>(); const [selected, setSelected] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(0); const [onlyMarked, setOnlyMarked] = useState(false); const [comparisonId, setComparisonId] = useState(""); const [lastBatch, setLastBatch] = useState("");
  const [notice, setNotice] = useState("");
  const initialized = useRef(false);
  useEffect(() => { if (stored.data && !initialized.current) { initialized.current = true; setSettings(stored.data.data.settings); } }, [stored.data]);
  const scan = useMutation({ mutationFn: (requestedSettings?: CleanupSettings) => api<CleanupAnalysis>("/api/v1/me/cleanup/analyze", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(requestedSettings || settings) }), onSuccess: (result) => { setAnalysis(result.data); setSelected([]); setComparisonId(""); } });
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
    if (input.action === "approve") setNotice(`${result.data.itemIds?.length || 0} items tagged. Existing manual tags were preserved.`);
    if (input.action === "approve") setLastBatch(result.data.batchId);
    if (input.action === "undo") { setLastBatch(""); setNotice("Cleanup tag batch undone. Manual tags and appearance were left unchanged."); }
    if (analysis && input.action === "dismiss") setAnalysis({ ...analysis, dismissed: [...analysis.dismissed, ...analysis.recommendations.filter((r) => input.itemIds?.includes(r.itemId)).map((r) => r.key)] });
    setSelected([]); void client.invalidateQueries({ queryKey: ["cleanup-state"] }); void client.invalidateQueries({ queryKey: ["gear"] }); void client.invalidateQueries({ queryKey: ["recent-items"] });
  } });
  const transfer = useMutation({ mutationFn: async (itemId: string) => {
    const result = await api<GearActionResult>("/api/v1/me/cleanup/pull", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ itemId, characterId: selectedCharacterId, settings }) });
    if (result.data.failed.length) throw new Error(result.data.failed[0]!.message);
    return result;
  }, onSuccess: (result) => { setNotice(result.warnings.length ? result.warnings.join(" ") : "Pulled successfully."); void client.invalidateQueries({ queryKey: ["gear"] }); void client.invalidateQueries({ queryKey: ["recent-items"] }); void client.invalidateQueries({ queryKey: ["cleanup-state"] }); void client.invalidateQueries({ queryKey: ["fireteam-recent-items"] }); scan.mutate(undefined); } });
  const restore = useMutation({ mutationFn: (itemId: string) => api<{ restored: boolean }>("/api/v1/me/cleanup/restore", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify({ itemId }) }), onSuccess: (result) => { void client.invalidateQueries({ queryKey: ["cleanup-state"] }); void client.invalidateQueries({ queryKey: ["gear"] }); void client.invalidateQueries({ queryKey: ["recent-items"] }); void client.invalidateQueries({ queryKey: ["fireteam-recent-items"] }); setNotice(result.warnings.length ? result.warnings.join(" ") : "Original appearance restored."); } });
  const change = (next: Partial<CleanupSettings>) => { setSettings((s) => ({ ...s, ...next })); setSelected([]); };
  const stale = Boolean(analysis && cleanupSettingsKey(settings) !== cleanupSettingsKey(analysis.settings));
  const marks = stored.data?.data.marks || analysis?.marks || {};
  const rows = (analysis?.recommendations || []).filter((r) => !analysis?.dismissed.includes(r.key) && r.confidence >= confidence && (!onlyMarked || marks[r.itemId]));
  const all: LootItem[] = analysis ? gearLootItems(analysis.gear.items, analysis.gear.weapons || []).map((item) => ({ ...item, cleanupRecommendation: marks[item.instanceId] })) : [];
  const byId = new Map(all.map((item) => [item.instanceId, item]));
  const comparison = analysis?.recommendations.find((entry) => entry.itemId === comparisonId);
  const closeComparison = useCallback(() => setComparisonId(""), []);
  const busy = scan.isPending || changes.isPending || transfer.isPending || restore.isPending;
  const pull = (item: LootItem) => {
    const recommendation = analysis?.recommendations.find((r) => r.itemId === item.instanceId);
    if (stale || !recommendation?.actionable || !marks[item.instanceId]) return;
    transfer.mutate(item.instanceId);
  };
  return <section className={styles.workspace}>
    <h2>Cleanup review</h2><p>Find redundant rolls, compare compatible armor, and review older gear across your whole account. Nothing is dismantled.</p>
    <div className={styles.presets}><button type="button" onClick={() => change({ exact: true, dominance: true, fullComparison: true, legacyReview: true, preferences: true, aggressive: false })}><strong>Full comparison</strong><small>Duplicates, better alternatives, older armor and rating sources</small></button><button type="button" onClick={() => change({ exact: true, dominance: false, fullComparison: false, legacyReview: false, preferences: false, aggressive: false })}><strong>Exact duplicates only</strong><small>Identical selectable rolls and armor stats</small></button></div>
    {notice && <p role="status">{notice}</p>}
    {restore.error && <p role="alert">{restore.error.message}</p>}
    {Object.keys(marks).length > 0 && <details><summary>Tagged items and appearance restore ({Object.keys(marks).length})</summary>{Object.entries(marks).map(([itemId, mark]) => <div key={itemId}><span>{byId.get(itemId)?.name || `Item ${itemId}`} · {mark.confidence}%</span><button disabled={busy} onClick={() => restore.mutate(itemId)}>Restore appearance</button><button disabled={busy} onClick={() => changes.mutate({ action: "undo", batchId: mark.batchId })}>Undo tag batch</button></div>)}</details>}
    {Boolean(stored.data?.data.cosmeticItems?.length) && <details><summary>Saved appearance restores</summary>{stored.data?.data.cosmeticItems.map((id) => <div key={id}>{byId.get(id)?.name || `Item ${id}`} <button disabled={busy} onClick={() => restore.mutate(id)}>Restore appearance</button></div>)}</details>}
    <div className={styles.controls}>
      <div className={styles.segments} role="group" aria-label="Activity focus">{(["both", "pve", "pvp"] as const).map((focus) => <button className={styles.segment} type="button" key={focus} aria-pressed={settings.focus === focus} onClick={() => change({ focus })}>{focus === "both" ? "PvE + PvP" : focus === "pve" ? "PvE" : "PvP"}</button>)}</div>
      <label>Candidates<CleanupSelect value={settings.location} onChange={(e) => change({ location: e.target.value as CleanupSettings["location"] })}><option value="vault">Vault</option><option value="all">All locations</option></CleanupSelect></label>
      <label><input type="checkbox" checked={settings.exact} onChange={(e) => change({ exact: e.target.checked })} /> Exact duplicates</label>
      <label><input type="checkbox" checked={settings.dominance} onChange={(e) => change({ dominance: e.target.checked })} /> Strictly better owned alternatives</label>
      <button disabled={busy} onClick={() => scan.mutate(undefined)}>{scan.isPending ? "Analyzing…" : "Analyze cleanup"}</button>
    </div>
    <div className={styles.ruleCards}><label><input type="checkbox" checked={settings.fullComparison !== false} onChange={(e) => change({ fullComparison: e.target.checked })} /><span>Compare across armor names<small>Same class, slot, fit and verified socket capabilities</small></span></label><label><input type="checkbox" checked={settings.legacyReview !== false} onChange={(e) => change({ legacyReview: e.target.checked })} /><span>Older armor / Armor 2.0 review<small>Compare with owned tiered armor; special uses stay review-only</small></span></label><label><input type="checkbox" checked={settings.preferences} onChange={(e) => change({ preferences: e.target.checked })} /><span>Rating and stat preferences<small>All selected sources must agree; unrated never means bad</small></span></label></div>
    <details><summary>Stat priorities, sources and protections</summary>
      <p>Locked, equipped, manually tagged, saved-build/loadout, crafted/enhanced, Exotic and highest-Power items are protected. Aggressive mode may show them for review, but cannot tag them.</p>
      <label><input type="checkbox" checked={settings.aggressive} onChange={(e) => change({ aggressive: e.target.checked })} /> Aggressive review</label>
      <div className={styles.controls}>{Object.entries(settings.priorities).map(([stat, weight]) => <label key={stat}>{stat}<CleanupSelect value={weight} onChange={(e) => change({ priorities: { ...settings.priorities, [stat]: Number(e.target.value) } })}><option value={0}>Ignore in preference comparisons</option><option value={1}>Protect this stat</option></CleanupSelect></label>)}</div>
      <p>Ignoring Health is optional, including for PvE. Exact and strict comparisons still consider every stat.</p>
      <p>Sources supplement owned-inventory comparisons when rating and stat preferences are enabled. All selected catalogs must agree; unknown ratings are not negative evidence.</p>
      {WEAPON_RATING_SOURCES.map((source) => <label key={source.id} title={source.note}><input type="checkbox" checked={settings.sources.includes(source.id)} disabled={settings.sources.length === 1 && settings.sources.includes(source.id)} onChange={(e) => change({ sources: e.target.checked ? [...settings.sources, source.id] : settings.sources.filter((id) => id !== source.id) })} />{source.label} · Used by: {source.usedBy}</label>)}
      {analysis?.sources.map((source) => <p key={source.id}>{source.name} · Catalog dated {source.reviewedAt}</p>)}
    </details><details><summary>Appearance marking · one style per class</summary>
      <h3>Identify approved items in game</h3>
      <label><input type="checkbox" checked={settings.cosmetics?.enabled || false} onChange={(e) => change({ cosmetics: { ornaments: {}, ...settings.cosmetics, enabled: e.target.checked } })} /> Apply selected cosmetics on approved pulls only</label>
      <p>Only choices Bungie currently reports as owned and insertable are offered. No purchases or paid socket actions. Undo tags does not restore appearance; use Restore appearance after pulling.</p>
      {(["weaponShader", "armorShader"] as const).map((key) => <label key={key}>{key === "weaponShader" ? "Weapon shader" : "Armor shader"}<CleanupSelect value={settings.cosmetics?.[key] || ""} onChange={(e) => change({ cosmetics: { enabled: false, ornaments: {}, ...settings.cosmetics, [key]: e.target.value || undefined } })}><option value="">Leave unchanged</option>{[...new Map((analysis?.cosmetics || []).filter((c) => c.kind === "shader" && (key === "weaponShader" ? c.group === "weapons" : c.group !== "weapons")).map((c) => [c.hash, c])).values()].map((c) => <option key={c.hash} value={c.hash}>{c.name}</option>)}</CleanupSelect></label>)}
      <div className={styles.classStyles}>{["Titan", "Hunter", "Warlock"].map((className) => <div className={styles.classStyle} key={className}><h3>{className}</h3><CleanupSelect value={settings.cosmetics?.classStyles?.[className] || ""} onChange={(e) => change({ cosmetics: { enabled: false, ...settings.cosmetics, classStyles: { ...settings.cosmetics?.classStyles, [className]: e.target.value }, ornaments: Object.fromEntries(Object.entries(settings.cosmetics?.ornaments || {}).filter(([group]) => !group.startsWith(`${className}:`))) } })}><option value="">Leave appearance unchanged</option>{analysis?.cosmeticSets?.filter((set) => set.className === className).map((set) => <option key={set.id} value={set.id}>{set.name} · {set.owned}/5 available pieces</option>)}</CleanupSelect><small>One choice covers helmet, arms, chest, legs and class item. Unowned or incompatible pieces are skipped.</small></div>)}</div>
      {analysis && !analysis.cosmeticSets?.length && <p>No verified, owned collection styles are available in this snapshot. Analyze again after the game catalog updates. No sets are guessed from similar names.</p>}
      {analysis && !analysis.cosmetics.length && <p>No owned, insertable cosmetic choices were returned for this inventory. Appearance will remain unchanged.</p>}
    </details>
    {(scan.error || changes.error || stored.error || transfer.error) && <p role="alert">{(scan.error || changes.error || stored.error || transfer.error)?.message}</p>}
    {stale && <p role="status">Settings changed. Analyze again before tagging or pulling.</p>}
    {analysis && <>
      {settings.focus === "pve" && <CleanupHealthReview items={all} onTag={onTag} />}
      {analysis.warnings.map((warning) => <p role="status" key={warning}>{warning}</p>)}
      <p>{analysis.insufficient.length > 0 ? `${analysis.insufficient.length} items have insufficient data and are excluded from tagging. ` : ""}Inventory checked {new Date(analysis.observedAt).toLocaleString()}.</p>
      <div className={styles.controls}>
        <label>Confidence<CleanupSelect value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}><option value={0}>All recommendations</option><option value={95}>95% and above</option><option value={99}>99% exact comparisons</option></CleanupSelect></label>
        <span title="Rules-based evidence tiers, not measured probabilities: 99% exact equivalent; 95% strictly better equivalent; 70% preference-based.">ⓘ What confidence means</span>
        <label><input type="checkbox" checked={onlyMarked} onChange={(e) => setOnlyMarked(e.target.checked)} /> Recommended dismantle tags only</label>
        <button disabled={busy || stale} onClick={() => setSelected(rows.filter((r) => r.actionable && !marks[r.itemId]).slice(0, 50).map((r) => r.itemId))}>Select eligible (up to 50)</button>
        <button disabled={busy || stale || !selected.length} onClick={() => changes.mutate({ action: "approve", itemIds: selected })}>Tag selected ({selected.length})</button>
        <button disabled={busy || !lastBatch} onClick={() => changes.mutate({ action: "undo", batchId: lastBatch })}>Undo last batch</button>
      </div>
      {comparison && byId.has(comparison.itemId) && byId.has(comparison.keeperId) && <CleanupComparison candidate={byId.get(comparison.itemId)!} keeper={byId.get(comparison.keeperId)!} recommendation={comparison} sources={analysis.sources} onClose={closeComparison} />}
      <LootHistoryGrid detailActions itemSummary={(item) => { const r = rows.find((entry) => entry.itemId === item.instanceId)!; return <><small title={r.reason}><Trash2 size={12} /> {r.confidence}% · {r.actionable ? "Review" : "Protected"}</small><button type="button" onClick={() => setComparisonId(r.itemId)}>Compare</button></>; }} title="Cleanup candidates" subtitle="Select a tile for details. Approve its tag before using [P] to pull. Protected items are review-only." items={rows.map((r) => byId.get(r.itemId)).filter((item): item is LootItem => Boolean(item))} onTag={onTag} onPull={pull} busy={busy || stale} empty="No eligible recommendations for these rules. Unique items and protected gear are retained." itemActions={(item) => {
        const r = rows.find((entry) => entry.itemId === item.instanceId)!;
        return <div className={styles.reason}><strong>{r.confidence}% · {marks[item.instanceId] ? "Recommended dismantle" : "Review"}</strong><p>{r.reason}</p><p>Keeping: {byId.get(r.keeperId)?.name || r.keeperId} · {byId.get(r.keeperId)?.power} Power</p><p>{r.confidence === 70 && item.kind === "weapon" ? `Sources: ${analysis.sources.map((s) => `${s.name} (${s.reviewedAt})`).join(", ")}` : "Source: local comparison of your owned items."}</p>{r.protections.length > 0 && <p>Protected: {r.protections.join(", ")}</p>}<label><input type="checkbox" aria-label={`Select ${item.name} for cleanup`} checked={selected.includes(item.instanceId)} disabled={!r.actionable || busy || stale || Boolean(marks[item.instanceId])} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, item.instanceId].slice(0, 50) : ids.filter((id) => id !== item.instanceId))} /> Approve</label><button onClick={() => setComparisonId(r.itemId)}>Compare with keeper</button><button disabled={busy || stale} onClick={() => changes.mutate({ action: "dismiss", itemIds: [item.instanceId] })}>Keep / dismiss</button><button disabled={busy || stale || !r.actionable || !marks[item.instanceId]} onClick={() => pull(item)}>Pull [P]</button>{marks[item.instanceId] && <button disabled={busy} onClick={() => changes.mutate({ action: "undo", batchId: marks[item.instanceId]!.batchId })}>Undo this batch</button>}</div>;
      }} />
    </>}
  </section>;
}
