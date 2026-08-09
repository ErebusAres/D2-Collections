import type { GearTag, RecentItemEvent, RecentItemTimelineData } from "@guardian-nexus/contracts";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RecentEventRow, type LootItem } from "./RecentLoot";
import styles from "../../pages/Pages.module.css";

interface LootWorkspaceProps {
  timeline?: RecentItemTimelineData;
  loading?: boolean;
  error?: Error | null;
  warnings?: string[];
  onRetry?: () => void;
  onTag: (item: LootItem, tag?: GearTag) => void;
  busy: boolean;
}

export function LootWorkspace({ timeline, loading = false, error, warnings = [], onRetry, onTag, busy }: LootWorkspaceProps) {
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
    <section className={styles.weaponControls}><label><Search /><input data-page-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recent gear, catalyst, engram, or material" /></label><select aria-label="Recent item period" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="1">Today</option><option value="3">Last 3 days</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option></select><select aria-label="Recent gear tag" value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">All gear tags</option><option value="none">Untagged gear</option><option value="favorite">Favorite gear</option><option value="keep">Keep gear</option><option value="junk">Junk gear</option><option value="archive">Archived gear</option><option value="infuse">Infuse gear</option></select></section>
    {(loading || error || warnings.length > 0) && <section className={styles.transitoryNotice}><div><strong>{loading ? "Checking recent items" : error ? "Recent timeline unavailable" : "Recent timeline notice"}</strong><p>{loading ? "Loading your saved Guardian item history…" : error ? error.message : warnings.join(" ")}{error && onRetry && <> <button type="button" onClick={onRetry}>Retry</button></>}</p></div></section>}
    <RecentEventRow title="Recent Weapons" subtitle="Physical weapon instances · newest to oldest" events={weapons} onTag={onTag} busy={busy} empty={`No recent weapons${emptySuffix}`} />
    <RecentEventRow title="Recent Armor" subtitle="Physical armor instances · newest to oldest" events={armor} onTag={onTag} busy={busy} empty={`No recent armor items${emptySuffix}`} />
    <RecentEventRow title="Recent Loot" subtitle="Catalysts, engrams, materials, and inventory gains · newest to oldest" events={loot} onTag={onTag} busy={busy} empty={`No catalysts, engrams, materials, or inventory gains${emptySuffix}`} />
    <section className={styles.transitoryNotice}><div><strong>How recent item history works</strong><p>Each row pages through the saved private timeline from newest on the left to oldest on the right. Guardian Nexus detects changes between Bungie profile snapshots, so observation time may be later than the exact in-game pickup time. An unknown weapon roll is not a bad roll and is never an automatic dismantle recommendation.</p></div></section>
  </>;
}

function eventSearchText(event: RecentItemEvent): string {
  const gear = event.gear;
  const gearText = !gear ? "" : gear.kind === "weapon"
    ? `${gear.itemType} ${gear.damageType} ${gear.perkColumns.flatMap((column) => column.options.map((perk) => perk.name)).join(" ")}`
    : `${gear.slot} ${Object.keys(gear.baseStats).join(" ")}`;
  return `${event.name} ${event.description || ""} ${event.rarity || ""} ${event.itemType || ""} ${gearText}`.toLocaleLowerCase();
}
