import type { CollectionData, GearData, MailboxData, QuestData, RewardsPassData, WatchlistDocument, WatchlistEntry, WatchlistKind, WatchlistMatch, XurData } from "@guardian-nexus/contracts";

export interface WatchlistSources {
  gear?: GearData;
  xur?: XurData;
  collection?: CollectionData;
  quests?: QuestData;
  rewards?: RewardsPassData;
  mailbox?: MailboxData;
}

export const WATCHLIST_KINDS: Array<{ kind: WatchlistKind; label: string; hint: string }> = [
  { kind: "item", label: "Item", hint: "Owned gear or a live Xûr offer" },
  { kind: "perk", label: "Weapon perk", hint: "Active or selectable perk on an owned weapon" },
  { kind: "vendor", label: "Xûr offer", hint: "Item or perk in Xûr's current inventory" },
  { kind: "collection", label: "Collection unlock", hint: "Owned Exotic Collection entry" },
  { kind: "catalyst", label: "Catalyst", hint: "Obtained or completed catalyst" },
  { kind: "pursuit", label: "Pursuit", hint: "Quest, bounty, or order in progress" },
  { kind: "reward", label: "Reward", hint: "Claimable Rewards Pass item" },
  { kind: "postmaster", label: "Postmaster", hint: "Alert at a chosen occupied-slot threshold" }
];

export function emptyWatchlist(): WatchlistDocument { return { schemaVersion: 1, entries: [] }; }

export function parseWatchlist(raw?: string): WatchlistDocument {
  if (!raw) return emptyWatchlist();
  try {
    const value = JSON.parse(raw) as Partial<WatchlistDocument>;
    if (value.schemaVersion !== 1 || !Array.isArray(value.entries)) return emptyWatchlist();
    return { schemaVersion: 1, entries: value.entries.filter(validEntry).slice(0, 50) };
  } catch { return emptyWatchlist(); }
}

function validEntry(value: unknown): value is WatchlistEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<WatchlistEntry>;
  return typeof row.id === "string" && typeof row.label === "string" && typeof row.target === "string"
    && WATCHLIST_KINDS.some((entry) => entry.kind === row.kind) && typeof row.enabled === "boolean"
    && typeof row.notify === "boolean" && typeof row.createdAt === "string";
}

const normalized = (value: string) => value.trim().toLocaleLowerCase();
const contains = (value: string, target: string) => normalized(value).includes(normalized(target));

export function evaluateWatchlist(document: WatchlistDocument, sources: WatchlistSources, now = new Date()): WatchlistMatch[] {
  return document.entries.map((entry) => evaluate(entry, sources, now));
}

function evaluate(entry: WatchlistEntry, sources: WatchlistSources, now: Date): WatchlistMatch {
  if (entry.expiresAt && Date.parse(entry.expiresAt) <= now.getTime()) return result(entry, "expired", "Watch expired", "Its saved deadline has passed.", "preference", "/watchlists");
  if (!entry.enabled) return result(entry, "unmatched", "Paused", "This watch is disabled.", "preference", "/watchlists");
  if (entry.kind === "postmaster") {
    if (!sources.mailbox) return unknown(entry, "mailbox", "/mailbox");
    const threshold = Math.max(1, entry.threshold || Math.ceil(sources.mailbox.capacity * .8));
    return sources.mailbox.count >= threshold
      ? result(entry, "matched", `${sources.mailbox.count}/${sources.mailbox.capacity} occupied`, `Postmaster reached the ${threshold}-slot alert threshold.`, "mailbox", "/mailbox")
      : result(entry, "unmatched", `${sources.mailbox.count}/${sources.mailbox.capacity} occupied`, `${threshold - sources.mailbox.count} slots remain before this alert.`, "mailbox", "/mailbox");
  }
  if (entry.kind === "item") {
    if (!sources.gear && !sources.xur) return unknown(entry, "gear", "/gear");
    const weapon = sources.gear?.weapons?.find((item) => contains(item.name, entry.target));
    const armor = sources.gear?.items.find((item) => contains(item.name, entry.target));
    const offer = sources.xur?.offers.find((item) => contains(item.name, entry.target));
    if (weapon || armor) return result(entry, "matched", `Owned: ${(weapon || armor)!.name}`, `A physical copy is present in ${(weapon || armor)!.location}.`, "gear", "/gear");
    if (offer) return result(entry, "matched", `Xûr is selling ${offer.name}`, "A matching live vendor offer is available.", "xur", "/xur");
    return result(entry, "unmatched", "Not found", "No matching owned copy or live Xûr offer was found.", "gear", "/gear");
  }
  if (entry.kind === "perk") {
    if (!sources.gear) return unknown(entry, "gear", "/gear");
    const weapon = sources.gear.weapons?.find((item) => item.perkColumns.some((column) => [column.active, ...column.options].some((perk) => perk && contains(perk.name, entry.target))));
    return weapon
      ? result(entry, "matched", `${entry.target} found on ${weapon.name}`, "The perk is active or selectable on an owned physical roll.", "gear", "/gear")
      : result(entry, "unmatched", "Perk not found", "No owned weapon exposes a matching active or selectable perk.", "gear", "/gear");
  }
  if (entry.kind === "vendor") {
    if (!sources.xur) return unknown(entry, "xur", "/xur");
    const offer = sources.xur.offers.find((item) => contains(item.name, entry.target) || item.perks.some((perk) => contains(perk.name, entry.target)));
    return offer
      ? result(entry, "matched", `Available from Xûr: ${offer.name}`, `The current ${sources.xur.inventoryStatus === "last-shipment" ? "last captured" : "live"} shipment matches this watch.`, "xur", "/xur")
      : result(entry, "unmatched", sources.xur.state === "available" ? "Not in this shipment" : "Xûr inventory unavailable", sources.xur.state === "available" ? "No current offer matches." : "The vendor feed cannot confirm this watch yet.", "xur", "/xur");
  }
  if (entry.kind === "collection" || entry.kind === "catalyst") {
    if (!sources.collection) return unknown(entry, "collection", "/collection");
    const item = sources.collection.entries.find((row) => contains(row.name, entry.target) || row.catalysts?.some((catalyst) => contains(catalyst.name, entry.target)));
    if (entry.kind === "collection") return item?.owned
      ? result(entry, "matched", `${item.name} unlocked`, "Bungie reports this Collection entry as owned.", "collection", "/collection")
      : result(entry, "unmatched", item ? `${item.name} is still missing` : "Collection entry not found", item ? item.guide.acquisition : "No matching Exotic entry was found.", "collection", "/collection");
    const catalyst = item?.catalysts?.find((row) => contains(row.name, entry.target)) || (item && contains(item.name, entry.target) ? item.catalysts?.[0] : undefined);
    return catalyst && catalyst.state !== "missing"
      ? result(entry, "matched", `${catalyst.name}: ${catalyst.state}`, catalyst.state === "complete" ? "Catalyst objectives are complete." : `Catalyst is obtained at ${catalyst.percent}% progress.`, "collection", "/collection?view=catalysts")
      : result(entry, "unmatched", catalyst ? `${catalyst.name} is missing` : "Catalyst not found", item?.guide.catalystSource || "No matching catalyst record was found.", "collection", "/collection?view=catalysts");
  }
  if (entry.kind === "pursuit") {
    if (!sources.quests) return unknown(entry, "quests", "/journey/quests");
    const quest = sources.quests.quests.find((row) => contains(row.name, entry.target) || row.rewards.some((reward) => contains(reward.name, entry.target)));
    return quest
      ? result(entry, "matched", `${quest.name}: ${quest.percent}%`, quest.expiresAt ? `Expires ${new Date(quest.expiresAt).toLocaleString()}.` : "The pursuit is active on this account.", "quests", `/quests/${quest.instanceId}`)
      : result(entry, "unmatched", "Pursuit not active", "No matching quest, bounty, order, or pursuit reward is active.", "quests", "/journey/quests");
  }
  if (!sources.rewards) return unknown(entry, "rewards", "/rewards");
  const reward = sources.rewards.rewards.find((row) => contains(row.name, entry.target));
  return reward?.state === "available"
    ? result(entry, "matched", `${reward.name} is ready to claim`, `Rewards Pass rank ${reward.requiredLevel} is available.`, "rewards", "/rewards")
    : result(entry, "unmatched", reward ? `${reward.name}: ${reward.state}` : "Reward not found", reward ? `Requires Rewards Pass rank ${reward.requiredLevel}.` : "No current pass reward matches.", "rewards", "/rewards");
}

function unknown(entry: WatchlistEntry, source: WatchlistMatch["source"], destinationUrl: string) {
  return result(entry, "unknown", "Waiting for private account data", "This source did not load, so Guardian Nexus will not guess.", source, destinationUrl);
}

function result(entry: WatchlistEntry, state: WatchlistMatch["state"], summary: string, reason: string, source: WatchlistMatch["source"], destinationUrl: string): WatchlistMatch {
  return { entryId: entry.id, state, summary, reason, source, destinationUrl };
}
