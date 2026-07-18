import type { ArmorItem, ArmorStatKey, GearActionRequest, GearActionResult, GearData, GearTag } from "@guardian-nexus/contracts";
import { applyGearSearchSuggestion, ARMOR_STAT_KEYS, gearSearchSuggestions, groupArmor, matchesGearSearch, type ArmorGroupMode } from "@guardian-nexus/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Grid2X2, Lock, LockOpen, RefreshCw, Search, Shield, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, mutationHeaders, queuedApi } from "../services/api/client";
import { GearTagBadge, GearTagFilter, GearTagPicker } from "../components/gear/GearTagPicker";
import { AuthGate, Freshness, PageHeader, QueryState } from "../components/common/Page";
import { useGuardian } from "../context/GuardianContext";
import styles from "./Pages.module.css";

const STAT_LABELS: Record<ArmorStatKey, string> = { health: "Health", melee: "Melee", grenade: "Grenade", super: "Super", class: "Class", weapons: "Weapons" };

export function GearPage() {
  const { selectedCharacterId, session, autoRefresh, preferences, setPreference } = useGuardian();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(""); const [searchFocused, setSearchFocused] = useState(false); const [slot, setSlot] = useState("all"); const [location, setLocation] = useState("all"); const [tag, setTag] = useState("all");
  const sort = GEAR_SORTS.has(preferences["gear.sort"] || "") ? preferences["gear.sort"]! : "analyzer";
  const [allClasses, setAllClasses] = useState(false); const [tolerance, setTolerance] = useState(5); const [groupMode, setGroupMode] = useState<ArmorGroupMode>("similar"); const [onlyGrouped, setOnlyGrouped] = useState(false); const [groupId, setGroupId] = useState("");
  useEffect(() => {
    const raw = preferences["gear.filters"];
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as Record<string, unknown>;
      if (typeof stored.slot === "string") setSlot(stored.slot);
      if (typeof stored.location === "string") setLocation(stored.location);
      if (typeof stored.tag === "string") setTag(stored.tag);
      if (typeof stored.allClasses === "boolean") setAllClasses(stored.allClasses);
      if (typeof stored.tolerance === "number") setTolerance(Math.max(0, Math.min(20, stored.tolerance)));
      if (["similar", "same-stats", "same-name-similar", "same-name-stats"].includes(String(stored.groupMode))) setGroupMode(stored.groupMode as ArmorGroupMode);
      if (typeof stored.onlyGrouped === "boolean") setOnlyGrouped(stored.onlyGrouped);
    } catch { /* Keep safe defaults when an older preference is malformed. */ }
  }, [preferences]);
  const saveFilters = (next: Partial<{ slot: string; location: string; tag: string; allClasses: boolean; tolerance: number; groupMode: ArmorGroupMode; onlyGrouped: boolean }>) => setPreference("gear.filters", JSON.stringify({ slot, location, tag, allClasses, tolerance, groupMode, onlyGrouped, ...next }));
  const result = useQuery({ queryKey: ["gear", selectedCharacterId], queryFn: () => api<GearData>(`/api/v1/me/gear?characterId=${encodeURIComponent(selectedCharacterId)}`), enabled: Boolean(session?.authenticated && selectedCharacterId), refetchInterval: autoRefresh ? 60_000 : false, refetchIntervalInBackground: false });
  const data = result.data?.data;
  const groups = useMemo(() => groupArmor(data?.items || [], tolerance, groupMode), [data?.items, tolerance, groupMode]);
  const groupedIds = useMemo(() => new Map(groups.flatMap((group) => group.items.map((item) => [item.instanceId, group] as const))), [groups]);
  const suggestions = useMemo(() => gearSearchSuggestions(search, data?.items || [], groups.map((group) => group.label)), [search, data?.items, groups]);
  const items = useMemo(() => {
    const values = (data?.items || []).filter((item) => (allClasses || item.className === data?.selectedClass || item.className === "Unknown") && (slot === "all" || item.slot === slot) && (location === "all" || item.location === location) && (tag === "all" || (tag === "none" ? !item.tag : item.tag === tag)) && (!onlyGrouped || groupedIds.has(item.instanceId)) && matchesGearSearch(item, search, { groupId: groupedIds.get(item.instanceId)?.label }));
    return values.sort((a, b) => compareGearSort(a, b, sort, groupedIds));
  }, [data, allClasses, slot, location, tag, onlyGrouped, search, sort, groupedIds]);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["gear", selectedCharacterId] });
  const stateMutation = useMutation({ mutationFn: (input: { itemInstanceId: string; tag?: GearTag | null; dismissed?: boolean }) => queuedApi("/api/v1/me/gear/item-state", { method: "PUT", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }), onSuccess: refresh });
  const actionMutation = useMutation({ mutationFn: (input: GearActionRequest) => queuedApi<GearActionResult>("/api/v1/me/gear/action", { method: "POST", headers: mutationHeaders(session?.csrfToken), body: JSON.stringify(input) }), onSuccess: refresh });
  const selectedGroup = groups.find((group) => group.id === groupId);
  const slots = [...new Set((data?.items || []).map((item) => item.slot))].sort();

  return <AuthGate><PageHeader eyebrow="Account-wide armor intelligence" title="Gear" description="Compare true base distributions, audit every adjustment, and manage armor across your characters and vault." actions={<><Freshness observedAt={result.data?.freshness.observedAt} warning={result.data?.warnings[0]} /><button className={styles.gearRefresh} onClick={() => void result.refetch()}><RefreshCw size={14} /> Sync armor</button></>} />
    <QueryState loading={result.isLoading} error={result.error as Error} hasData={Boolean(data)} onRetry={() => void result.refetch()} />
    {data && <>
      <section className={styles.gearSummary}>{[["Armor", data.totals.armor], ["Vault", data.totals.vault], ["Equipped", data.totals.equipped], ["Locked", data.totals.locked], ["Groups", groups.length], ["New", data.totals.newItems]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
      <section className={styles.gearControls}>
        <label className={styles.gearSearch}><Search size={15} /><input value={search} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Tab" && suggestions[0]) { event.preventDefault(); setSearch(applyGearSearchSuggestion(search, suggestions[0].value)); } }} placeholder="Search or try isrank:s isarchetype:paragon" role="combobox" aria-expanded={searchFocused && suggestions.length > 0} aria-controls="gear-search-suggestions" />{searchFocused && suggestions.length > 0 && <div id="gear-search-suggestions" className={styles.gearSearchSuggestions} role="listbox">{suggestions.map((suggestion) => <button key={suggestion.value} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => setSearch(applyGearSearchSuggestion(search, suggestion.value))}><b>{suggestion.value}</b><span>{suggestion.description}</span></button>)}</div>}</label>
        <select value={slot} onChange={(event) => { setSlot(event.target.value); saveFilters({ slot: event.target.value }); }}><option value="all">All slots</option>{slots.map((value) => <option key={value}>{value}</option>)}</select>
        <select value={location} onChange={(event) => { setLocation(event.target.value); saveFilters({ location: event.target.value }); }}><option value="all">All locations</option><option value="equipped">Equipped</option><option value="inventory">Characters</option><option value="vault">Vault</option></select>
        <GearTagFilter value={tag as "all" | "none" | GearTag} onChange={(value) => { setTag(value); saveFilters({ tag: value }); }} />
        <select value={sort} onChange={(event) => setPreference("gear.sort", event.target.value)}><option value="analyzer">Group ID (1A–5Z)</option><option value="base">Best base total</option><option value="current">Best current total</option><option value="rank">Best rank</option><option value="tier">Highest tier</option><option value="power">Highest Power</option><option value="grouped">Grouped first</option><option value="untagged">Untagged first</option><option value="slot">Slot order</option><option value="new">Newest</option><option value="name">Name A–Z</option></select>
        <button className={allClasses ? styles.gearControlActive : ""} onClick={() => { setAllClasses((value) => !value); saveFilters({ allClasses: !allClasses }); }}>{allClasses ? "All classes" : data.selectedClass}</button>
        <button disabled title="Table layout is planned after the card workspace is validated"><Grid2X2 size={14} /> Cards</button>
      </section>
      <section className={styles.gearGroupingControls}>
        <label><span>Grouping method</span><select value={groupMode} onChange={(event) => { const value = event.target.value as ArmorGroupMode; setGroupMode(value); saveFilters({ groupMode: value }); }}><option value="similar">Similar top stats</option><option value="same-stats">Exact stats, any name</option><option value="same-name-similar">Same name + similar stats</option><option value="same-name-stats">Same name + exact stats</option></select></label>
        <label className={`${styles.tolerance} ${groupMode.includes("stats") ? styles.controlDisabled : ""}`}>Similarity ±<strong>{tolerance}</strong><input type="range" min="0" max="20" value={tolerance} disabled={groupMode.includes("stats")} onChange={(event) => { const value = Number(event.target.value); setTolerance(value); saveFilters({ tolerance: value }); }} /></label>
        <button className={onlyGrouped ? styles.gearControlActive : ""} onClick={() => { setOnlyGrouped((value) => !value); saveFilters({ onlyGrouped: !onlyGrouped }); }}><Grid2X2 size={13} /> Only show groups</button>
        <p><b>{groups.length}</b> comparison groups · Smart search supports quoted names, negation, numeric comparisons, and filters such as <code>is:locked</code>, <code>group:1A</code>, <code>tuned:grenade</code>, and <code>basetotal:&gt;=70</code>. Press Tab to accept the first suggestion.</p>
      </section>
      {data.items.filter((item) => item.isNew).slice(0, 20).length > 0 && <section className={styles.recentGear}><header><Sparkles size={15} /><strong>Recently discovered</strong></header><div>{data.items.filter((item) => item.isNew).sort((a,b) => Date.parse(b.firstSeenAt)-Date.parse(a.firstSeenAt)).slice(0,20).map((item) => <button key={item.instanceId} title={item.name} onClick={() => stateMutation.mutate({ itemInstanceId: item.instanceId, dismissed: true })}>{item.icon && <img src={item.icon} alt="" />}<span>{item.name}</span><X size={11} /></button>)}</div></section>}
      <section className={styles.gearGrid}>{items.map((item) => <ArmorCard key={item.instanceId} item={item} statIcons={data.statIcons} group={groupedIds.get(item.instanceId)} selectedCharacterId={selectedCharacterId} onCompare={setGroupId} onTag={(value) => stateMutation.mutate({ itemInstanceId: item.instanceId, tag: value || null })} onAction={(input, confirm) => (!confirm || window.confirm(confirm)) && actionMutation.mutate(input)} busy={stateMutation.isPending || actionMutation.isPending} />)}</section>
      {!items.length && <section className={styles.xurEmpty}><Shield /><h2>No matching armor</h2><p>Change the filters or sync again after Bungie has minted fresh inventory data.</p></section>}
      {selectedGroup && <ComparisonStation group={selectedGroup} statIcons={data.statIcons} selectedCharacterId={selectedCharacterId} onClose={() => setGroupId("")} onAction={(input, message) => window.confirm(message) && actionMutation.mutate(input)} />}
      {(stateMutation.error || actionMutation.error) && <div className={styles.gearError}>{(stateMutation.error || actionMutation.error)?.message}</div>}
    </>}
  </AuthGate>;
}

function ArmorCard({ item, statIcons, group, selectedCharacterId, onCompare, onTag, onAction, busy }: { item: ArmorItem; statIcons: GearData["statIcons"]; group?: ReturnType<typeof groupArmor>[number]; selectedCharacterId: string; onCompare: (id: string) => void; onTag: (tag: "" | GearTag) => void; onAction: (input: GearActionRequest, confirm?: string) => void; busy: boolean }) {
  const groupClass = group ? styles[`groupColor${group.colorIndex}`] : "";
  return <article className={`${styles.armorCard} ${item.rarity === "Exotic" ? styles.exoticArmor : ""} ${item.masterworked ? styles.masterworkedArmor : ""} ${groupClass}`}>
    <header><div className={styles.armorArt}>{item.icon && <img src={item.icon} alt="" />}<GearTagBadge tag={item.tag} /><div className={`${styles.tierRail} ${tierTone(item.gearTier)}`} title={`D2 armor tier ${item.gearTier || "unavailable"}`} aria-label={`Armor tier ${item.gearTier || "unavailable"}`}>{Array.from({ length: 5 }, (_, index) => { const level = 5 - index; return <span key={level} className={`${styles.tierMark} ${level <= item.gearTier ? styles.tierMarkOn : ""}`}>◆</span>; })}</div><b className={styles.powerChip}>{item.power || ""}</b></div><div><span>{item.rarity} · {item.slot}</span><h2>{item.name}</h2><p>{item.location}{item.equipped ? " · Equipped" : ""}{item.masterworked ? " · Masterworked" : ""}</p></div><div className={styles.armorBadges}><div className={styles.grade}><strong>{item.grade.letter}</strong><small>{item.grade.score ?? "—"}</small></div>{group && <button className={`${styles.groupBadge} ${groupClass}`} title={`Compare group ${group.label}`} onClick={() => onCompare(group.id)}><b>{group.label}</b><ChevronRight size={10} /></button>}</div></header>
    <div className={styles.armorIdentity}>{item.archetype && <span title={item.archetype.description}>{item.archetype.icon && <img src={item.archetype.icon} alt="" />}<b>{item.archetype.name}</b></span>}{item.gearTier === 5 && (item.tunedStat ? <span className={styles.tunedIdentity} title={item.tuning?.description || `${STAT_LABELS[item.tunedStat]} is this armor's tuned stat`}>{statIcons[item.tunedStat] && <img src={statIcons[item.tunedStat]} alt="" />}<b>Tuned: {STAT_LABELS[item.tunedStat]}</b></span> : <span className={`${styles.tunedIdentity} ${styles.tuningUnavailable}`} title="Bungie did not identify one fixed directional tuning stat for this Tier 5 item"><b>{item.rarity === "Exotic" ? "Flexible tuning" : "Tuned stat unavailable"}</b></span>)}{item.setBonuses.slice(0,2).map((bonus) => <span key={bonus.hash} title={bonus.description}>{bonus.icon && <img src={bonus.icon} alt="" />}<b>{bonus.pieces ? `${bonus.pieces}× ` : ""}{bonus.name}</b></span>)}</div>
    <div className={styles.armorStats}>{ARMOR_STAT_KEYS.map((key) => <StatRow key={key} statKey={key} item={item} icon={statIcons[key]} />)}<TotalBreakdown item={item} /></div>
    <footer><GearTagPicker value={item.tag} onChange={(value) => onTag(value || "")} disabled={busy} compact /><span className={styles.footerSpacer} /><button title={item.locked ? "Unlock" : "Lock"} onClick={() => onAction({ action: "setLock", itemInstanceId: item.instanceId, locked: !item.locked, characterId: item.ownerCharacterId || selectedCharacterId })}>{item.locked ? <Lock size={13} /> : <LockOpen size={13} />}</button>{item.location === "vault" ? <button title="Pull to Selected Guardian" onClick={() => onAction({ action: "transfer", itemInstanceId: item.instanceId, target: "character", targetCharacterId: selectedCharacterId })}><ArrowDownToLine size={13} /></button> : <button disabled={item.equipped} title={item.equipped ? "Equip another item before vaulting this armor" : "Move to vault"} onClick={() => onAction({ action: "transfer", itemInstanceId: item.instanceId, target: "vault" })}><ArrowUpFromLine size={13} /></button>}<button title="Equip on Selected Guardian" onClick={() => onAction({ action: "equip", itemInstanceId: item.instanceId, characterId: selectedCharacterId }, `Equip ${item.name} on the Selected Guardian? This may move it between characters first.`)}><Shield size={13} /></button></footer>
  </article>;
}

function tierTone(tier: number): string {
  if (tier >= 5) return styles.tierGold!;
  if (tier >= 3) return styles.tierPurple!;
  return styles.tierWhite!;
}

const ADJUSTMENT_TYPES = ["masterwork", "mod", "artifice", "tuning", "other"] as const;

function StatRow({ statKey, item, icon }: { statKey: ArmorStatKey; item: ArmorItem; icon?: string }) {
  const adjustments = ADJUSTMENT_TYPES.map((type) => ({ type, value: item.adjustments.filter((entry) => entry.type === type).reduce((sum, entry) => sum + Number(entry.stats[statKey] || 0), 0) })).filter((entry) => entry.value !== 0);
  const scale = Math.max(40, item.currentStats[statKey], item.baseStats[statKey]);
  let cursor = item.baseStats[statKey];
  return <div className={`${styles.armorStat} ${item.tunedStat === statKey ? styles.tunedStat : ""}`}>
    <span className={styles.statIcon}>{icon && <img src={icon} alt="" />}{item.tunedStat === statKey && <small>TUNED</small>}</span><b>{STAT_LABELS[statKey]}</b>
    <span className={styles.statTrack}><i className={styles.segmentBase} style={{ left: 0, width: `${Math.max(0, item.baseStats[statKey]) / scale * 100}%` }} />{adjustments.map((entry, index) => { const start = entry.value < 0 ? cursor + entry.value : cursor; const width = Math.abs(entry.value); cursor += entry.value; return <i key={`${entry.type}-${index}`} className={`${styles.statSegment} ${styles[`segment${capitalize(entry.type)}`]} ${entry.value < 0 ? styles.segmentNegative : ""}`} style={{ left: `${Math.max(0, start) / scale * 100}%`, width: `${width / scale * 100}%` }} title={`${capitalize(entry.type)} ${entry.value > 0 ? "+" : ""}${entry.value}`} />; })}</span>
    <strong>{item.baseStats[statKey]}</strong><em className={item.currentStats[statKey] >= item.baseStats[statKey] ? styles.statPositive : styles.statNegative}>{item.currentStats[statKey]}</em>
  </div>;
}

function TotalBreakdown({ item }: { item: ArmorItem }) {
  const totals = ADJUSTMENT_TYPES.map((type) => ({ type, value: item.adjustments.filter((entry) => entry.type === type).reduce((sum, entry) => sum + ARMOR_STAT_KEYS.reduce((statSum, key) => statSum + Number(entry.stats[key] || 0), 0), 0) })).filter((entry) => entry.value !== 0);
  return <div className={styles.armorTotal}><span>Base + adjustments = current</span><strong><b>{item.baseTotal}</b>{totals.map((entry) => <em key={entry.type} className={`${styles[`total${capitalize(entry.type)}`]} ${entry.value < 0 ? styles.totalNegative : ""}`} title={capitalize(entry.type)}>{entry.value > 0 ? "+" : ""}{entry.value}</em>)}<i>=</i><mark>{item.currentTotal}</mark></strong></div>;
}

function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }

const GEAR_SLOT_ORDER = ["Helmet", "Gauntlets", "Chest Armor", "Leg Armor", "Class Item"];
const GEAR_RANK_ORDER = ["S", "A", "B", "C", "D", "F", "—"];
const GEAR_SORTS = new Set(["analyzer", "base", "current", "rank", "tier", "power", "grouped", "untagged", "slot", "new", "name"]);

function compareGearSort(a: ArmorItem, b: ArmorItem, sort: string, groupedIds: Map<string, ReturnType<typeof groupArmor>[number]>): number {
  const fallback = () => compareGroupOrder(a, b, groupedIds);
  if (sort === "base") return b.baseTotal - a.baseTotal || fallback();
  if (sort === "current") return b.currentTotal - a.currentTotal || b.baseTotal - a.baseTotal || fallback();
  if (sort === "rank") return GEAR_RANK_ORDER.indexOf(a.grade.letter) - GEAR_RANK_ORDER.indexOf(b.grade.letter) || (b.grade.score || 0) - (a.grade.score || 0) || fallback();
  if (sort === "tier") return b.gearTier - a.gearTier || fallback();
  if (sort === "power") return b.power - a.power || fallback();
  if (sort === "grouped") return Number(groupedIds.has(b.instanceId)) - Number(groupedIds.has(a.instanceId)) || fallback();
  if (sort === "untagged") return Number(Boolean(a.tag)) - Number(Boolean(b.tag)) || fallback();
  if (sort === "slot") return slotOrder(a.slot) - slotOrder(b.slot) || a.name.localeCompare(b.name) || b.baseTotal - a.baseTotal;
  if (sort === "new") return Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt) || fallback();
  if (sort === "name") return a.name.localeCompare(b.name) || fallback();
  return fallback();
}

function compareGroupOrder(a: ArmorItem, b: ArmorItem, groupedIds: Map<string, ReturnType<typeof groupArmor>[number]>): number {
  const aGroup = groupedIds.get(a.instanceId); const bGroup = groupedIds.get(b.instanceId);
  if (aGroup && bGroup) return aGroup.label.localeCompare(bGroup.label, undefined, { numeric: true }) || aGroup.items.findIndex((item) => item.instanceId === a.instanceId) - bGroup.items.findIndex((item) => item.instanceId === b.instanceId);
  if (aGroup) return -1;
  if (bGroup) return 1;
  return a.slot.localeCompare(b.slot) || b.baseTotal - a.baseTotal || a.name.localeCompare(b.name);
}

function slotOrder(slot: string): number { const index = GEAR_SLOT_ORDER.indexOf(slot); return index < 0 ? 99 : index; }

function ComparisonStation({ group, statIcons, selectedCharacterId, onClose, onAction }: { group: ReturnType<typeof groupArmor>[number]; statIcons: GearData["statIcons"]; selectedCharacterId: string; onClose: () => void; onAction: (input: GearActionRequest, message: string) => void }) {
  const vaultIds = group.items.filter((item) => item.location === "vault").map((item) => item.instanceId);
  return <div className={styles.compareOverlay}><button aria-label="Close comparison" onClick={onClose} /><section><header><div><span>Armor comparison station</span><h2>{group.label}</h2><p>{group.items.length} similar items · base-stat order</p></div><div>{vaultIds.length > 0 && <button onClick={() => onAction({ action: "groupPull", itemInstanceIds: vaultIds, characterId: selectedCharacterId }, `Pull ${vaultIds.length} armor items from the vault?`)}><ArrowDownToLine size={14} /> Pull group ({vaultIds.length})</button>}<button onClick={onClose}><X size={18} /></button></div></header><div className={styles.compareGrid}>{group.items.map((item, index) => <div key={item.instanceId} className={styles.compareArmor}><span>{index === 0 ? "Best base total" : item.location}</span><h3>{item.name}</h3>{item.icon && <img className={styles.compareItemIcon} src={item.icon} alt="" />}<strong>{item.baseTotal} base / {item.currentTotal} current</strong>{ARMOR_STAT_KEYS.map((key) => <StatRow key={key} statKey={key} item={item} icon={statIcons[key]} />)}<small>{item.archetype?.icon && <img src={item.archetype.icon} alt="" />}{item.archetype?.name || "Archetype unavailable"}</small></div>)}</div></section></div>;
}
