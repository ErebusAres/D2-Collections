import type { GearTag, RecentItemEvent, RecentItemTimelineData } from "@guardian-nexus/contracts";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RecentEventRow, type LootItem, type LootPull, type WeaponSocketChange } from "./RecentLoot";
import styles from "../../pages/Pages.module.css";

interface LootWorkspaceProps {
  timeline?: RecentItemTimelineData;
  loading?: boolean;
  error?: Error | null;
  warnings?: string[];
  onRetry?: () => void;
  onTag: (item: LootItem, tag?: GearTag) => void;
  onPull?: LootPull;
  onSocketChange?: WeaponSocketChange;
  busy: boolean;
}

export function LootWorkspace({ timeline, loading = false, error, warnings = [], onRetry, onTag, onPull, onSocketChange, busy }: LootWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("all");
  const [days, setDays] = useState(30);
  const events = useMemo(() => {
    const earliest = Date.now() - Math.max(1, days) * 24 * 60 * 60_000;
    const query = search.trim().toLocaleLowerCase();
    return (timeline?.events || []).filter((event) => {
      const observedAt = Date.parse(event.lastObservedAt || event.observedAt);
      if (!Number.isFinite(observedAt) || observedAt < earliest) return false;
      const matchesSearch = !query || eventSearchText(event).includes(query);
      const matchesGearTag = !event.gear || tag === "all" || (tag === "none" ? !event.gear.tag : event.gear.tag === tag);
      return matchesSearch && matchesGearTag;
    }).sort((left, right) => Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt));
  }, [timeline?.events, days, search, tag]);
  const weapons = events.filter((event) => event.kind === "weapon-found");
  const armor = events.filter((event) => event.kind === "armor-found");
  const loot = events.filter((event) => event.kind !== "weapon-found" && event.kind !== "armor-found");
  const emptySuffix = search.trim() || tag !== "all" ? " match these filters." : ` were observed in the last ${days} days.`;
  return <>
    <section className={styles.weaponSummary}>{[["Observed", events.length], ["Weapons", weapons.length], ["Armor", armor.length], ["Loot", loot.length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <section className={styles.weaponControls}><label><Search /><input data-page-search aria-label="Search recent gear" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recent gear, catalyst, engram, or material" /></label><select aria-label="Recent item period" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="1">Today</option><option value="3">Last 3 days</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option></select><select aria-label="Recent gear tag" value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">All gear tags</option><option value="none">Untagged gear</option><option value="favorite">Favorite gear</option><option value="keep">Keep gear</option><option value="junk">Junk gear</option><option value="archive">Archived gear</option><option value="infuse">Infuse gear</option></select></section>
    {(loading || error || warnings.length > 0) && <section className={styles.transitoryNotice}><div><strong>{loading ? "Checking recent items" : error ? "Recent Loot unavailable" : "Recent Loot notice"}</strong><p>{loading ? "Loading your recent items…" : error ? error.message : warnings.join(" ")}{error && onRetry && <> <button type="button" onClick={onRetry}>Retry</button></>}</p></div></section>}
    <RecentEventRow title="Recent Weapons" subtitle="Newest first" events={weapons} onTag={onTag} onPull={onPull} onSocketChange={onSocketChange} busy={busy} empty={`No recent weapons${emptySuffix}`} />
    <RecentEventRow title="Recent Armor" subtitle="Newest first" events={armor} onTag={onTag} onPull={onPull} onSocketChange={onSocketChange} busy={busy} empty={`No recent armor items${emptySuffix}`} />
    <RecentEventRow title="Recent Loot" subtitle="Catalysts, engrams, materials, and other items · newest first" events={loot} onTag={onTag} onSocketChange={onSocketChange} busy={busy} empty={`No catalysts, engrams, materials, or inventory gains${emptySuffix}`} />
    <section className={styles.transitoryNotice}><div><strong>About Recent Loot</strong><p>Items are shown newest first. The time shown is when Guardian Nexus first noticed the item, which can be a little later than when it dropped in game. “Unrated” means there is not enough rating data; it does not mean the roll is bad.</p></div></section>
  </>;
}

function eventSearchText(event: RecentItemEvent): string {
  const gear = event.gear;
  const gearText = !gear ? "" : gear.kind === "weapon"
    ? `${gear.itemType} ${gear.damageType} ${gear.perkColumns.flatMap((column) => column.options.map((perk) => perk.name)).join(" ")}`
    : `${gear.slot} ${Object.keys(gear.baseStats).join(" ")}`;
  return `${event.name} ${event.description || ""} ${event.rarity || ""} ${event.itemType || ""} ${gearText}`.toLocaleLowerCase();
}
