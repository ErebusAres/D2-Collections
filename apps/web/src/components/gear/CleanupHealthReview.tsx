import { useState } from "react";
import type { GearTag } from "@guardian-nexus/contracts";
import { LootHistoryGrid, type LootItem } from "./RecentLoot";

export function healthReviewItems(items: LootItem[]) {
  return items.filter((item) => item.kind === "armor" && Number.isFinite(item.baseStats.health) && item.baseStats.health > 0)
    .sort((a, b) => (b.kind === "armor" ? b.baseStats.health : 0) - (a.kind === "armor" ? a.baseStats.health : 0) || a.instanceId.localeCompare(b.instanceId));
}

export function CleanupHealthReview({ items, onTag }: { items: LootItem[]; onTag: (item: LootItem, tag?: GearTag) => void }) {
  const [page, setPage] = useState(0);
  const armor = healthReviewItems(items), pages = Math.max(1, Math.ceil(armor.length / 24)), current = Math.min(page, pages - 1);
  return <details open><summary>PvE Health armor review · {armor.length} owned items</summary>
    <p>All owned armor with base Health, highest first—including protected items and character inventories. These are review items, not automatic dismantle recommendations. Ignore Health in stat priorities only if that matches your build.</p>
    <LootHistoryGrid title="Armor with Health" subtitle="Inspect stats, location and tags. Health alone does not make an item redundant." items={armor.slice(current * 24, (current + 1) * 24)} onTag={onTag} empty="No armor with known positive base Health in this snapshot." itemSummary={(item) => item.kind === "armor" ? <small>{item.baseStats.health} base Health · Review</small> : null} />
    {pages > 1 && <div><button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous Health items</button><span> Page {current + 1} of {pages} </span><button type="button" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>Next Health items</button></div>}
  </details>;
}
