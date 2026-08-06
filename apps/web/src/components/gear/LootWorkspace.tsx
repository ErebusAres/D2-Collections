import type { GearData, GearTag } from "@guardian-nexus/contracts";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LootHistoryGrid, observedLootWithin, type LootItem } from "./RecentLoot";
import styles from "../../pages/Pages.module.css";

export function LootWorkspace({ data, onTag, busy }: { data: GearData; onTag: (item: LootItem, tag?: GearTag) => void; busy: boolean }) {
  const [kind, setKind] = useState<"all" | "armor" | "weapon">("all");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("all");
  const [days, setDays] = useState(7);
  const history = useMemo(() => observedLootWithin(data.items, data.weapons || [], days, kind), [data, days, kind]);
  const items = useMemo(() => history.filter((item) => {
    const matchesSearch = !search.trim() || `${item.name} ${item.rarity} ${item.kind === "weapon" ? `${item.itemType} ${item.damageType} ${item.perkColumns.flatMap((column) => column.options.map((perk) => perk.name)).join(" ")}` : `${item.slot} ${Object.keys(item.baseStats).join(" ")}`}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    return matchesSearch && (tag === "all" || (tag === "none" ? !item.tag : item.tag === tag));
  }), [history, search, tag]);
  return <>
    <section className={styles.weaponSummary}>{[["Observed", history.length], ["Weapons", history.filter((item) => item.kind === "weapon").length], ["Armor", history.filter((item) => item.kind === "armor").length], ["Tagged", history.filter((item) => item.tag).length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <section className={styles.weaponControls}><label><Search /><input data-page-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recent item or perk" /></label><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="1">Today</option><option value="3">Last 3 days</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option></select><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">Weapons and armor</option><option value="weapon">Weapons only</option><option value="armor">Armor only</option></select><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">All tags</option><option value="none">Untagged</option><option value="favorite">Favorite</option><option value="keep">Keep</option><option value="junk">Junk</option><option value="archive">Archive</option><option value="infuse">Infuse</option></select></section>
    <LootHistoryGrid title={`${days === 1 ? "Today" : `Last ${days} days`}`} subtitle="Weapons and armor remain visible after tagging or review" items={items} onTag={onTag} busy={busy} empty="No first-observed weapons or armor match this period and these filters." />
    <section className={styles.transitoryNotice}><div><strong>What “recent” means</strong><p>Items are ordered by the first time Guardian Nexus observed each physical instance. Bungie does not provide a reliable exact drop timestamp. An unrated weapon is unknown—not bad—and Guardian Nexus never recommends automatic dismantling.</p></div></section>
  </>;
}
