import type { ArmorStatKey, GearActionRequest, GearData, GearTag } from "@guardian-nexus/contracts";
import { ARMOR_STAT_KEYS } from "@guardian-nexus/domain";
import { ArrowDownToLine, Info, Lock, LockOpen, MoreHorizontal, RotateCcw, Search, Shield } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GearTagFilter } from "./GearTagPicker";
import { gearLootItems, LootHistoryGrid, type LootItem } from "./RecentLoot";
import styles from "../../pages/Pages.module.css";
import vaultStyles from "./VaultWorkspace.module.css";

type VaultKind = "all" | "weapon" | "armor";
type VaultStatSource = "base" | "current";
type VaultSort = "type" | "name" | "power" | "newest" | "rarity" | "armor-total";
type StatRange = { min: string; max: string };
type StatRanges = Record<ArmorStatKey, StatRange>;

const STAT_LABELS: Record<ArmorStatKey, string> = { health: "Health", melee: "Melee", grenade: "Grenade", super: "Super", class: "Class", weapons: "Weapons" };
const WEAPON_SLOT_ORDER = ["Kinetic", "Energy", "Power", "Unknown"];
const ARMOR_SLOT_ORDER = ["Helmet", "Gauntlets", "Chest Armor", "Leg Armor", "Class Item"];
const PAGE_SIZE = 120;

export function VaultWorkspace({ data, selectedCharacterId, onTag, onAction, busy }: {
  data: GearData;
  selectedCharacterId: string;
  onTag: (item: LootItem, tag?: GearTag) => void;
  onAction: (input: GearActionRequest, confirm?: string) => void;
  busy: boolean;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<VaultKind>("all");
  const [slot, setSlot] = useState("all");
  const [rarity, setRarity] = useState("all");
  const [weaponType, setWeaponType] = useState("all");
  const [damageType, setDamageType] = useState("all");
  const [armorClass, setArmorClass] = useState("all");
  const [tag, setTag] = useState<"all" | "none" | GearTag>("all");
  const [lockState, setLockState] = useState("all");
  const [sort, setSort] = useState<VaultSort>("type");
  const [statSource, setStatSource] = useState<VaultStatSource>("base");
  const [statRanges, setStatRanges] = useState<StatRanges>(emptyStatRanges);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const vault = useMemo(() => gearLootItems(data.items, data.weapons || []).filter((item) => item.location === "vault"), [data.items, data.weapons]);
  const weaponSlots = useMemo(() => sortedValues(vault.filter(isWeapon).map((item) => item.slot), WEAPON_SLOT_ORDER), [vault]);
  const armorSlots = useMemo(() => sortedValues(vault.filter(isArmor).map((item) => item.slot), ARMOR_SLOT_ORDER), [vault]);
  const weaponTypes = useMemo(() => sortedValues(vault.filter(isWeapon).map((item) => item.itemType)), [vault]);
  const damageTypes = useMemo(() => sortedValues(vault.filter(isWeapon).map((item) => item.damageType)), [vault]);
  const armorClasses = useMemo(() => sortedValues(vault.filter(isArmor).map((item) => item.className)), [vault]);
  const rarities = useMemo(() => sortedValues(vault.map((item) => item.rarity)), [vault]);
  const activeStatCount = ARMOR_STAT_KEYS.filter((key) => statRanges[key].min !== "" || statRanges[key].max !== "").length;

  const filtered = useMemo(() => vault.filter((item) => {
    if (kind !== "all" && item.kind !== kind) return false;
    if (!matchesSlot(item, slot)) return false;
    if (rarity === "exotic" && normalize(item.rarity) !== "exotic") return false;
    if (rarity === "non-exotic" && normalize(item.rarity) === "exotic") return false;
    if (rarity.startsWith("exact:") && item.rarity !== rarity.slice(6)) return false;
    if (weaponType !== "all" && (item.kind !== "weapon" || item.itemType !== weaponType)) return false;
    if (damageType !== "all" && (item.kind !== "weapon" || item.damageType !== damageType)) return false;
    if (armorClass !== "all" && (item.kind !== "armor" || item.className !== armorClass)) return false;
    if (tag !== "all" && (tag === "none" ? Boolean(item.tag) : item.tag !== tag)) return false;
    if (lockState !== "all" && item.locked !== (lockState === "locked")) return false;
    if (!matchesSearch(item, search) || !matchesStats(item, statRanges, statSource)) return false;
    return true;
  }).sort((left, right) => compareVaultItems(left, right, sort)), [armorClass, damageType, kind, lockState, rarity, search, slot, sort, statRanges, statSource, tag, vault, weaponType]);
  const visible = filtered.slice(0, visibleCount);
  const reset = () => {
    setSearch(""); setKind("all"); setSlot("all"); setRarity("all"); setWeaponType("all"); setDamageType("all"); setArmorClass("all"); setTag("all"); setLockState("all"); setSort("type"); setStatSource("base"); setStatRanges(emptyStatRanges()); setVisibleCount(PAGE_SIZE);
  };
  const changeKind = (value: VaultKind) => {
    setKind(value);
    if ((value === "weapon" && slot.startsWith("armor:")) || (value === "armor" && slot.startsWith("weapon:"))) setSlot("all");
    if (value === "weapon") setArmorClass("all");
    if (value === "armor") { setWeaponType("all"); setDamageType("all"); }
    setVisibleCount(PAGE_SIZE);
  };
  const updateStat = (key: ArmorStatKey, field: keyof StatRange, value: string) => {
    setStatRanges((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
    setVisibleCount(PAGE_SIZE);
  };

  return <>
    <section className={styles.weaponSummary}>{[
      ["Vault items", vault.length], ["Matching", filtered.length], ["Weapons", vault.filter(isWeapon).length], ["Armor", vault.filter(isArmor).length], ["Exotics", vault.filter((item) => normalize(item.rarity) === "exotic").length], ["Junk tagged", vault.filter((item) => item.tag === "junk").length]
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>

    <section className={styles.vaultControls}>
      <label className={styles.vaultSearch}><Search /><span>Search</span><input data-page-search value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Item, perk, type, archetype, or stat" /></label>
      <label><span>Item type</span><select aria-label="Vault item type" value={kind} onChange={(event) => changeKind(event.target.value as VaultKind)}><option value="all">Weapons and armor</option><option value="weapon">Weapons only</option><option value="armor">Armor only</option></select></label>
      <label><span>Slot</span><select aria-label="Vault equipment slot" value={slot} onChange={(event) => { setSlot(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All slots</option>{kind !== "armor" && <optgroup label="Weapon slots">{weaponSlots.map((value) => <option key={value} value={`weapon:${value}`}>{value}</option>)}</optgroup>}{kind !== "weapon" && <optgroup label="Armor slots">{armorSlots.map((value) => <option key={value} value={`armor:${value}`}>{value}</option>)}</optgroup>}</select></label>
      <label><span>Rarity</span><select aria-label="Vault rarity" value={rarity} onChange={(event) => { setRarity(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All rarities</option><option value="exotic">Exotic</option><option value="non-exotic">Non-exotic</option>{rarities.map((value) => <option key={value} value={`exact:${value}`}>{value} only</option>)}</select></label>
      <label><span>Weapon type</span><select aria-label="Vault weapon type" value={weaponType} disabled={kind === "armor"} onChange={(event) => { setWeaponType(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All weapon types</option>{weaponTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Weapon element</span><select aria-label="Vault weapon element" value={damageType} disabled={kind === "armor"} onChange={(event) => { setDamageType(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All elements</option>{damageTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Armor class</span><select aria-label="Vault armor class" value={armorClass} disabled={kind === "weapon"} onChange={(event) => { setArmorClass(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">All classes</option>{armorClasses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Lock state</span><select aria-label="Vault lock state" value={lockState} onChange={(event) => { setLockState(event.target.value); setVisibleCount(PAGE_SIZE); }}><option value="all">Locked and unlocked</option><option value="locked">Locked</option><option value="unlocked">Unlocked</option></select></label>
      <label><span>Sort</span><select aria-label="Vault sort" value={sort} onChange={(event) => setSort(event.target.value as VaultSort)}><option value="type">Item type and slot</option><option value="name">Name A–Z</option><option value="power">Highest Power</option><option value="newest">Newest observed</option><option value="rarity">Rarity</option><option value="armor-total">Highest armor base total</option></select></label>
      <div className={styles.vaultTagFilter}><span>Tag</span><GearTagFilter value={tag} onChange={(value) => { setTag(value); setVisibleCount(PAGE_SIZE); }} /></div>
      <button type="button" className={styles.vaultReset} onClick={reset}><RotateCcw /> Reset filters</button>
    </section>

    <details className={styles.vaultStatFilters} open>
      <summary><span>Armor stat filters</span><b>{activeStatCount ? `${activeStatCount} active` : "No limits"}</b></summary>
      <div className={styles.vaultStatHeader}><p>Filter the roll itself with <b>Base</b> stats, or include installed tuning and adjustments with <b>Current</b> stats. Setting Health minimum to 1 finds armor with Health; setting its maximum to 0 finds zero-Health armor.</p><label><span>Stat source</span><select aria-label="Vault armor stat source" value={statSource} onChange={(event) => { setStatSource(event.target.value as VaultStatSource); setVisibleCount(PAGE_SIZE); }}><option value="base">Base stats</option><option value="current">Current stats</option></select></label><button type="button" onClick={() => { setStatRanges(emptyStatRanges()); setVisibleCount(PAGE_SIZE); }}>Clear stats</button></div>
      <div className={styles.vaultStatGrid}>{ARMOR_STAT_KEYS.map((key) => <div key={key}><span>{data.statIcons[key] && <img src={data.statIcons[key]} alt="" />}<b>{STAT_LABELS[key]}</b></span><label><small>Minimum</small><input aria-label={`Minimum ${STAT_LABELS[key]}`} type="number" min="0" inputMode="numeric" placeholder="Any" value={statRanges[key].min} onChange={(event) => updateStat(key, "min", event.target.value)} /></label><label><small>Maximum</small><input aria-label={`Maximum ${STAT_LABELS[key]}`} type="number" min="0" inputMode="numeric" placeholder="Any" value={statRanges[key].max} onChange={(event) => updateStat(key, "max", event.target.value)} /></label></div>)}</div>
    </details>

    <section className={styles.vaultSafety}><Info /><div><strong>Dismantling is not available to third-party Destiny apps</strong><p>Bungie exposes transfer, equip, and lock actions, but not delete or dismantle. Use these filters and the private Junk tag to build a cleanup list, then verify and dismantle those items in-game.</p></div></section>

    <LootHistoryGrid title="Vault contents" subtitle={visible.length < filtered.length ? `Showing ${visible.length} of ${filtered.length} matching items · hover or focus for full details` : "Only physical weapons and armor currently reported in your Vault · hover or focus for full details"} items={visible} onTag={onTag} busy={busy} empty="No Vault items match these filters. Reset the filters or sync gear after changing your inventory in Destiny." itemActions={(item) => <VaultItemActions item={item} selectedCharacterId={selectedCharacterId} onAction={onAction} busy={busy} />} />
    {visible.length < filtered.length && <button type="button" className={styles.vaultShowMore} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more items</button>}
  </>;
}

function VaultItemActions({ item, selectedCharacterId, onAction, busy }: { item: LootItem; selectedCharacterId: string; onAction: (input: GearActionRequest, confirm?: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("pointerdown", closeOutside); window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);
  const act = (input: GearActionRequest, confirm?: string) => { setOpen(false); if (confirm) onAction(input, confirm); else onAction(input); };
  return <div className={vaultStyles.itemActions} ref={root}>
    <button type="button" className={vaultStyles.actionTrigger} disabled={busy} title={`Actions for ${item.name}`} aria-label={`Actions for ${item.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><MoreHorizontal /></button>
    {open && <div className={vaultStyles.actionMenu} role="menu" aria-label={`Actions for ${item.name}`}>
      <button type="button" role="menuitem" className={item.locked ? vaultStyles.unlockAction : vaultStyles.lockAction} disabled={busy} onClick={() => act({ action: "setLock", itemInstanceId: item.instanceId, locked: !item.locked, characterId: selectedCharacterId })}>{item.locked ? <LockOpen /> : <Lock />}<span>{item.locked ? "Unlock" : "Lock"}</span></button>
      <button type="button" role="menuitem" className={vaultStyles.pullAction} disabled={busy} onClick={() => act({ action: "transfer", itemInstanceId: item.instanceId, target: "character", targetCharacterId: selectedCharacterId })}><ArrowDownToLine /><span>Pull to Guardian</span></button>
      <button type="button" role="menuitem" className={vaultStyles.equipAction} disabled={busy} onClick={() => act({ action: "equip", itemInstanceId: item.instanceId, characterId: selectedCharacterId }, `Equip ${item.name} on the Selected Guardian? Bungie will transfer it from the Vault first.`)}><Shield /><span>Equip</span></button>
    </div>}
  </div>;
}

function emptyStatRanges(): StatRanges {
  return { health: { min: "", max: "" }, melee: { min: "", max: "" }, grenade: { min: "", max: "" }, super: { min: "", max: "" }, class: { min: "", max: "" }, weapons: { min: "", max: "" } };
}

function isWeapon(item: LootItem): item is Extract<LootItem, { kind: "weapon" }> { return item.kind === "weapon"; }
function isArmor(item: LootItem): item is Extract<LootItem, { kind: "armor" }> { return item.kind === "armor"; }
function normalize(value: string): string { return value.trim().toLocaleLowerCase(); }

function sortedValues(values: string[], preferred: string[] = []): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => {
    const leftIndex = preferred.indexOf(left); const rightIndex = preferred.indexOf(right);
    if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
    return left.localeCompare(right);
  });
}

function matchesSlot(item: LootItem, slot: string): boolean {
  if (slot === "all") return true;
  const [kind, ...value] = slot.split(":");
  return item.kind === kind && item.slot === value.join(":");
}

function matchesSearch(item: LootItem, search: string): boolean {
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const details = item.kind === "weapon"
    ? [item.name, item.rarity, item.slot, item.damageType, item.itemType, item.masterwork?.name, ...item.originTraits.flatMap((trait) => [trait.name, trait.description]), ...item.perkColumns.flatMap((column) => column.options.flatMap((perk) => [perk.name, perk.description]))]
    : [item.name, item.rarity, item.slot, item.className, item.archetype?.name, item.tuning?.name, ...item.setBonuses.flatMap((perk) => [perk.name, perk.description]), ...item.perks.flatMap((perk) => [perk.name, perk.description]), ...ARMOR_STAT_KEYS.map((key) => `${STAT_LABELS[key]} ${item.baseStats[key]} ${item.currentStats[key]}`)];
  const haystack = normalize(details.filter(Boolean).join(" "));
  return terms.every((term) => haystack.includes(term));
}

function matchesStats(item: LootItem, ranges: StatRanges, source: VaultStatSource): boolean {
  const active = ARMOR_STAT_KEYS.filter((key) => ranges[key].min !== "" || ranges[key].max !== "");
  if (!active.length) return true;
  if (item.kind !== "armor") return false;
  const values = source === "base" ? item.baseStats : item.currentStats;
  return active.every((key) => {
    const minimum = ranges[key].min === "" ? undefined : Number(ranges[key].min);
    const maximum = ranges[key].max === "" ? undefined : Number(ranges[key].max);
    return (minimum === undefined || !Number.isFinite(minimum) || values[key] >= minimum) && (maximum === undefined || !Number.isFinite(maximum) || values[key] <= maximum);
  });
}

function compareVaultItems(left: LootItem, right: LootItem, sort: VaultSort): number {
  if (sort === "name") return left.name.localeCompare(right.name) || left.instanceId.localeCompare(right.instanceId);
  if (sort === "power") return right.power - left.power || left.name.localeCompare(right.name);
  if (sort === "newest") return safeTime(right.firstSeenAt) - safeTime(left.firstSeenAt) || left.name.localeCompare(right.name);
  if (sort === "rarity") return rarityOrder(left.rarity) - rarityOrder(right.rarity) || left.name.localeCompare(right.name);
  if (sort === "armor-total") return Number(right.kind === "armor") - Number(left.kind === "armor") || (right.kind === "armor" ? right.baseTotal : 0) - (left.kind === "armor" ? left.baseTotal : 0) || left.name.localeCompare(right.name);
  return left.kind.localeCompare(right.kind) || slotOrder(left) - slotOrder(right) || left.name.localeCompare(right.name);
}

function slotOrder(item: LootItem): number {
  const order = item.kind === "weapon" ? WEAPON_SLOT_ORDER : ARMOR_SLOT_ORDER;
  const index = order.indexOf(item.slot);
  return index < 0 ? 999 : index;
}

function rarityOrder(value: string): number { return ({ exotic: 0, legendary: 1, rare: 2, uncommon: 3, common: 4 } as Record<string, number>)[normalize(value)] ?? 99; }
function safeTime(value: string): number { const time = Date.parse(value); return Number.isFinite(time) ? time : 0; }
