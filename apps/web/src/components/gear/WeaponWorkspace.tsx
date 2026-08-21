import type { GearActionRequest, GearData, GearTag, UserPreferenceKey, WeaponItem } from "@guardian-nexus/contracts";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Columns3, Hammer, Lock, LockOpen, Search, Shield, Sparkles, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GearTagBadge, GearTagFilter, GearTagPicker } from "./GearTagPicker";
import { GearTierRail } from "./GearTierRail";
import { parseWatchlist } from "../../modules/watchlists/watchlists";
import { loadWeaponRatings, type WeaponRatingDatabase } from "../../modules/loot/weaponEvaluator";
import styles from "../../pages/Pages.module.css";
import { RecentItemRow, recentLoot } from "./RecentLoot";
import { WeaponRatingPanel } from "./WeaponRatingPanel";

interface Props {
  data: GearData;
  selectedCharacterId: string;
  preferences: Partial<Record<UserPreferenceKey, string>>;
  setPreference: (key: UserPreferenceKey, value: string) => void;
  onTag: (item: WeaponItem, tag: "" | GearTag) => void;
  onAction: (input: GearActionRequest, confirm?: string) => void;
  busy: boolean;
}

export function WeaponWorkspace({ data, selectedCharacterId, preferences, setPreference, onTag, onAction, busy }: Props) {
  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState("all");
  const [location, setLocation] = useState("all");
  const [tag, setTag] = useState<"all" | "none" | GearTag>("all");
  const [review, setReview] = useState("all");
  const [compareHash, setCompareHash] = useState("");
  const [ratings, setRatings] = useState<WeaponRatingDatabase>();
  const [ratingAttempt, setRatingAttempt] = useState(0);
  const wishlist = useMemo(() => stringSet(preferences["weapons.wishlist"]), [preferences]);

  useEffect(() => {
    let cancelled = false;
    let retry: number | undefined;
    void loadWeaponRatings().then((database) => {
      if (cancelled) return;
      setRatings(database);
      if (!database) retry = window.setTimeout(() => setRatingAttempt((value) => value + 1), 15_000);
    });
    return () => { cancelled = true; if (retry !== undefined) window.clearTimeout(retry); };
  }, [ratingAttempt]);

  useEffect(() => {
    try {
      const stored = JSON.parse(preferences["weapons.filters"] || "{}") as Record<string, unknown>;
      if (typeof stored.slot === "string") setSlot(stored.slot);
      if (typeof stored.location === "string") setLocation(stored.location);
      if (typeof stored.tag === "string") setTag(stored.tag as typeof tag);
      if (typeof stored.review === "string") setReview(stored.review);
    } catch { /* Older or malformed filters fall back safely. */ }
  }, [preferences]);

  const saveFilters = (next: Partial<{ slot: string; location: string; tag: string; review: string }>) => setPreference("weapons.filters", JSON.stringify({ slot, location, tag, review, ...next }));
  const weapons = useMemo(() => (data.weapons || []).filter((weapon) => {
    const query = search.trim().toLocaleLowerCase();
    const haystack = [weapon.name, weapon.itemType, weapon.damageType, ...weapon.perkColumns.flatMap((column) => column.options.map((perk) => perk.name)), ...weapon.originTraits.map((perk) => perk.name)].join(" ").toLocaleLowerCase();
    return (!query || query.split(/\s+/).every((part) => haystack.includes(part)))
      && (slot === "all" || weapon.slot === slot)
      && (location === "all" || weapon.location === location)
      && (tag === "all" || (tag === "none" ? !weapon.tag : weapon.tag === tag))
      && (review === "all" || review === "wishlisted" ? review !== "wishlisted" || wishlist.has(weapon.itemHash) : weapon.reviewState === review);
  }).sort((left, right) => Number(wishlist.has(right.itemHash)) - Number(wishlist.has(left.itemHash)) || right.duplicateCount - left.duplicateCount || right.power - left.power || left.name.localeCompare(right.name)), [data.weapons, location, review, search, slot, tag, wishlist]);
  const comparison = (data.weapons || []).filter((weapon) => weapon.itemHash === compareHash);
  const toggleWishlist = (itemHash: string) => {
    const next = new Set(wishlist);
    const adding = !next.has(itemHash);
    if (!adding) next.delete(itemHash); else next.add(itemHash);
    setPreference("weapons.wishlist", JSON.stringify([...next]));
    const weapon = data.weapons?.find((item) => item.itemHash === itemHash);
    if (!weapon) return;
    const watchlist = parseWatchlist(preferences["watchlists.v1"]);
    const id = `weapon:${itemHash}`;
    const entries = adding
      ? [...watchlist.entries.filter((entry) => entry.id !== id), { id, kind: "item" as const, label: weapon.name, target: weapon.name, notes: "Added from the Weapon Rolls wishlist.", enabled: true, notify: true, createdAt: new Date().toISOString() }]
      : watchlist.entries.filter((entry) => entry.id !== id);
    setPreference("watchlists.v1", JSON.stringify({ schemaVersion: 1, entries }));
  };

  return <>
    <section className={styles.weaponSummary}>{[
      ["Weapons", data.weapons?.length || 0], ["Duplicates", duplicateGroups(data.weapons || []).length], ["Crafted", (data.weapons || []).filter((weapon) => weapon.crafted).length],
      ["Enhanced", (data.weapons || []).filter((weapon) => weapon.enhanced).length], ["Wishlisted", (data.weapons || []).filter((weapon) => wishlist.has(weapon.itemHash)).length], ["Needs review", (data.weapons || []).filter((weapon) => weapon.reviewState === "duplicate-review" || weapon.reviewState === "incomplete-data").length]
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <section className={styles.weaponControls}>
      <label><Search /><input data-page-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search weapon, type, damage, or perk" /></label>
      <select value={slot} onChange={(event) => { setSlot(event.target.value); saveFilters({ slot: event.target.value }); }}><option value="all">All slots</option><option>Kinetic</option><option>Energy</option><option>Power</option><option>Unknown</option></select>
      <select value={location} onChange={(event) => { setLocation(event.target.value); saveFilters({ location: event.target.value }); }}><option value="all">All locations</option><option value="equipped">Equipped</option><option value="inventory">Characters</option><option value="vault">Vault</option></select>
      <GearTagFilter value={tag} onChange={(value) => { setTag(value); saveFilters({ tag: value }); }} />
      <select value={review} onChange={(event) => { setReview(event.target.value); saveFilters({ review: event.target.value }); }}><option value="all">All review states</option><option value="wishlisted">Wishlisted</option><option value="configured">Configured</option><option value="unique">Unique copy</option><option value="duplicate-review">Duplicate review</option><option value="incomplete-data">Incomplete data</option></select>
    </section>
    <RecentItemRow title="Recently acquired weapons" items={recentLoot([], data.weapons || [], "weapon", 20)} onTag={(item, value) => item.kind === "weapon" && onTag(item, value || "")} onSocketChange={(item, socketIndex, plugItemHash) => onAction({ action: "setWeaponSocket", itemInstanceId: item.instanceId, characterId: selectedCharacterId, socketIndex, plugItemHash })} busy={busy} />
    <section className={styles.weaponGrid}>{weapons.map((weapon) => <WeaponCard key={weapon.instanceId} weapon={{ ...weapon, wishlisted: wishlist.has(weapon.itemHash) }} ratings={ratings} selectedCharacterId={selectedCharacterId} onWishlist={() => toggleWishlist(weapon.itemHash)} onCompare={() => setCompareHash(weapon.itemHash)} onTag={(value) => onTag(weapon, value)} onAction={onAction} busy={busy} />)}</section>
    {!weapons.length && <section className={styles.xurEmpty}><Shield /><h2>No matching weapons</h2><p>Change the filters or sync after the versioned weapon manifest has been refreshed.</p></section>}
    {comparison.length > 1 && <WeaponComparison items={comparison.map((weapon) => ({ ...weapon, wishlisted: wishlist.has(weapon.itemHash) }))} onClose={() => setCompareHash("")} />}
  </>;
}

function WeaponCard({ weapon, ratings, selectedCharacterId, onWishlist, onCompare, onTag, onAction, busy }: { weapon: WeaponItem; ratings?: WeaponRatingDatabase; selectedCharacterId: string; onWishlist: () => void; onCompare: () => void; onTag: (tag: "" | GearTag) => void; onAction: Props["onAction"]; busy: boolean }) {
  return <article tabIndex={0} data-gear-instance={weapon.instanceId} onMouseEnter={activateGearShortcut} onMouseLeave={deactivateGearShortcut} onFocus={activateGearShortcut} onBlur={deactivateGearShortcut} className={`${styles.weaponCard} ${weapon.rarity === "Exotic" ? styles.exoticArmor : ""} ${weapon.masterworked ? styles.masterworkedArmor : ""}`} data-review={weapon.reviewState}>
    <header><div className={styles.weaponArt}><GearTierRail tier={weapon.gearTier} kind="Weapon" />{weapon.icon && <img src={weapon.icon} alt="" />}<GearTagBadge tag={weapon.tag} /><b>{weapon.power || ""}</b></div><div><span>{weapon.damageType} · {weapon.itemType}</span><h2>{weapon.name}</h2><p>{weapon.location}{weapon.equipped ? " · Equipped" : ""}</p></div><button className={weapon.wishlisted ? styles.weaponWishlisted : ""} onClick={onWishlist} title={weapon.wishlisted ? "Remove weapon from wishlist" : "Add weapon to wishlist"}><Star /></button></header>
    <div className={styles.weaponSignals}>{weapon.crafted && <span><Hammer /> Crafted</span>}{weapon.enhanced && <span><Sparkles /> Enhanced</span>}{weapon.originTraits.map((trait) => <span key={trait.hash} title={trait.description}>{trait.icon && <img src={trait.icon} alt="" />}{trait.name}</span>)}</div>
    <WeaponRatingPanel weapon={weapon} ratings={ratings} busy={busy} onSelectPlug={(socketIndex, plugItemHash) => onAction({ action: "setWeaponSocket", itemInstanceId: weapon.instanceId, characterId: selectedCharacterId, socketIndex, plugItemHash })} />
    <div className={styles.weaponReview}><CheckCircle2 /><span><b>{reviewLabel(weapon.reviewState)}</b><small>{weapon.reviewReasons[0]}</small></span>{weapon.duplicateCount > 1 && <button onClick={onCompare}>Compare {weapon.duplicateCount}</button>}</div>
    <footer><GearTagPicker value={weapon.tag} onChange={(value) => onTag(value || "")} disabled={busy} compact /><span className={styles.footerSpacer} /><button title={weapon.locked ? "Unlock" : "Lock"} onClick={() => onAction({ action: "setLock", itemInstanceId: weapon.instanceId, locked: !weapon.locked, characterId: weapon.ownerCharacterId || selectedCharacterId })}>{weapon.locked ? <Lock /> : <LockOpen />}</button>{weapon.location === "vault" ? <button title="Pull to Selected Guardian" onClick={() => onAction({ action: "transfer", itemInstanceId: weapon.instanceId, target: "character", targetCharacterId: selectedCharacterId })}><ArrowDownToLine /></button> : <button disabled={weapon.equipped} title={weapon.equipped ? "Equip another weapon before vaulting this one" : "Move to vault"} onClick={() => onAction({ action: "transfer", itemInstanceId: weapon.instanceId, target: "vault" })}><ArrowUpFromLine /></button>}<button title="Equip on Selected Guardian" onClick={() => onAction({ action: "equip", itemInstanceId: weapon.instanceId, characterId: selectedCharacterId }, `Equip ${weapon.name} on the Selected Guardian? This may move it between characters first.`)}><Shield /></button></footer>
  </article>;
}

function WeaponComparison({ items, onClose }: { items: WeaponItem[]; onClose: () => void }) {
  const maxColumns = Math.max(...items.map((item) => item.perkColumns.length));
  return <div className={styles.compareOverlay}><button aria-label="Close weapon comparison" onClick={onClose} /><section><header><div><span>Weapon roll comparison</span><h2>{items[0]?.name}</h2><p>{items.length} physical copies · separate PvE and PvP evidence</p></div><button onClick={onClose}><X /></button></header><div className={styles.weaponCompareGrid}>{items.map((item) => <article key={item.instanceId}><header>{item.icon && <img src={item.icon} alt="" />}<span><b>{item.location}{item.equipped ? " · Equipped" : ""}</b><small>{item.power} Power · {item.damageType}</small></span>{item.wishlisted && <Star />}</header><WeaponRatingPanel weapon={item} compact />{Array.from({ length: maxColumns }, (_, index) => { const column = item.perkColumns[index]; return <div key={index}>{column?.active?.icon ? <img src={column.active.icon} alt="" /> : <Columns3 />}<span><b>{column?.active?.name || "No verified perk"}</b><small>{column?.options.map((perk) => perk.name).join(" · ") || "Bungie data unavailable"}</small></span></div>; })}<footer><strong>{reviewLabel(item.reviewState)}</strong><p>{item.reviewReasons[0]}</p></footer></article>)}</div></section></div>;
}

function duplicateGroups(items: WeaponItem[]): string[] { const counts = new Map<string, number>(); for (const item of items) counts.set(item.itemHash, (counts.get(item.itemHash) || 0) + 1); return [...counts].filter(([, count]) => count > 1).map(([hash]) => hash); }
function reviewLabel(value: WeaponItem["reviewState"]): string { return value === "configured" ? "Configured copy" : value === "duplicate-review" ? "Compare duplicates" : value === "incomplete-data" ? "Roll data incomplete" : "Only physical copy"; }
function stringSet(value?: string): Set<string> { try { const parsed = JSON.parse(value || "[]"); return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []); } catch { return new Set(); } }
function activateGearShortcut(event: React.SyntheticEvent<HTMLElement>): void { document.querySelectorAll<HTMLElement>("[data-gear-shortcut-active='true']").forEach((entry) => delete entry.dataset.gearShortcutActive); event.currentTarget.dataset.gearShortcutActive = "true"; }
function deactivateGearShortcut(event: React.SyntheticEvent<HTMLElement>): void { delete event.currentTarget.dataset.gearShortcutActive; }
