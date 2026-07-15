import type { ArmorItem, ArmorStatKey } from "@guardian-nexus/contracts";

export interface GearSearchContext { groupId?: string }
export interface GearSearchSuggestion { value: string; description: string }

const STAT_KEYS: ArmorStatKey[] = ["health", "melee", "grenade", "super", "class", "weapons"];
const FIXED_SUGGESTIONS: GearSearchSuggestion[] = [
  { value: "is:grouped", description: "Items assigned to a comparison group" },
  { value: "is:locked", description: "Locked armor" },
  { value: "is:equipped", description: "Currently equipped armor" },
  { value: "is:masterworked", description: "Masterworked armor" },
  { value: "is:tier5", description: "Tier 5 armor" },
  { value: "is:exotic", description: "Exotic armor" },
  { value: "is:new", description: "Recently discovered armor" },
  { value: "is:tagged", description: "Armor with a saved tag" },
  { value: "isrank:s", description: "S-rank armor" },
  { value: "isarchetype:", description: "Armor archetype, such as Paragon" },
  { value: "group:", description: "Comparison group ID, such as 1A" },
  { value: "slot:", description: "Armor slot" },
  { value: "class:", description: "Guardian class" },
  { value: "location:", description: "Vault, inventory, or equipped" },
  { value: "tag:", description: "Saved armor tag" },
  { value: "tuned:", description: "Tier 5 tuned stat" },
  { value: "basetotal:>=70", description: "Minimum true base total" },
  { value: "currenttotal:>=75", description: "Minimum current total" },
  { value: "power:>=550", description: "Minimum Power" },
  { value: "-is:locked", description: "Negate any filter with a leading minus" }
];

export function matchesGearSearch(item: ArmorItem, query: string, context: GearSearchContext = {}): boolean {
  return tokenize(query).every((rawToken) => {
    const negated = rawToken.startsWith("-");
    const token = negated ? rawToken.slice(1) : rawToken;
    const split = token.indexOf(":");
    const matched = split < 0 ? searchable(item, context).includes(normalize(unquote(token))) : matchesOperator(item, normalize(token.slice(0, split)), unquote(token.slice(split + 1)), context);
    return negated ? !matched : matched;
  });
}

export function gearSearchSuggestions(query: string, items: ArmorItem[], groupIds: string[]): GearSearchSuggestion[] {
  const active = activeToken(query).toLowerCase();
  const dynamic = uniqueSuggestions([
    ...items.map((item) => ({ value: `isarchetype:${quoteValue(item.archetype?.name)}`, description: "Archetype" })),
    ...items.map((item) => ({ value: `name:${quoteValue(item.name)}`, description: "Item name" })),
    ...items.map((item) => ({ value: `slot:${quoteValue(item.slot)}`, description: "Armor slot" })),
    ...items.map((item) => ({ value: `class:${item.className.toLowerCase()}`, description: "Guardian class" })),
    ...items.flatMap((item) => item.setBonuses.map((set) => ({ value: `set:${quoteValue(set.name)}`, description: "Armor set bonus" }))),
    ...groupIds.map((groupId) => ({ value: `group:${groupId}`, description: "Comparison group" }))
  ]).filter((entry) => !entry.value.endsWith(":"));
  const candidates = uniqueSuggestions([...FIXED_SUGGESTIONS, ...dynamic]);
  return candidates.filter((entry) => !active || entry.value.toLowerCase().startsWith(active) || entry.value.toLowerCase().includes(active)).slice(0, 8);
}

export function applyGearSearchSuggestion(query: string, value: string): string {
  const match = query.match(/(?:^|\s)(\S*)$/);
  const start = match ? query.length - match[1]!.length : query.length;
  return `${query.slice(0, start)}${value}${value.endsWith(":") ? "" : " "}`;
}

function matchesOperator(item: ArmorItem, rawKey: string, rawValue: string, context: GearSearchContext): boolean {
  const key = ({ rank: "isrank", archetype: "isarchetype", base: "basetotal", current: "currenttotal" } as Record<string, string>)[rawKey] || rawKey;
  const value = normalize(rawValue);
  if (key === "is") return matchesIs(item, value, context);
  if (key === "isrank") return normalize(item.grade.letter) === value;
  if (key === "isarchetype") return includes(item.archetype?.name, value);
  if (key === "name") return includes(item.name, value);
  if (key === "slot") return includes(item.slot, value);
  if (key === "class") return includes(item.className, value);
  if (key === "rarity") return includes(item.rarity, value);
  if (key === "location") return includes(item.equipped ? "equipped" : item.location, value);
  if (key === "tag") return includes(item.tag || "none", value);
  if (key === "group") return includes(context.groupId, value);
  if (key === "set") return item.setBonuses.some((set) => includes(set.name, value));
  if (key === "perk") return item.perks.some((perk) => includes(perk.name, value));
  if (key === "tuned") return includes(item.tunedStat, value);
  if (key === "tier") return numericMatch(item.gearTier, value);
  if (key === "power") return numericMatch(item.power, value);
  if (key === "basetotal") return numericMatch(item.baseTotal, value);
  if (key === "currenttotal") return numericMatch(item.currentTotal, value);
  if (STAT_KEYS.includes(key as ArmorStatKey)) return numericMatch(item.baseStats[key as ArmorStatKey], value);
  return searchable(item, context).includes(normalize(`${rawKey}:${rawValue}`));
}

function matchesIs(item: ArmorItem, value: string, context: GearSearchContext): boolean {
  const states: Record<string, boolean> = {
    grouped: Boolean(context.groupId), ungrouped: !context.groupId, locked: item.locked, unlocked: !item.locked,
    equipped: item.equipped, masterworked: item.masterworked, masterwork: item.masterworked, tier5: item.gearTier === 5,
    exotic: normalize(item.rarity) === "exotic", legendary: normalize(item.rarity) === "legendary", new: item.isNew,
    tagged: Boolean(item.tag), untagged: !item.tag, vault: item.location === "vault", inventory: item.location === "inventory",
    hunter: item.className === "Hunter", titan: item.className === "Titan", warlock: item.className === "Warlock"
  };
  return states[value] ?? false;
}

function numericMatch(actual: number, expression: string): boolean {
  const match = expression.match(/^(>=|<=|>|<|=)?(-?\d+(?:\.\d+)?)$/);
  if (!match) return false;
  const expected = Number(match[2]);
  if (match[1] === ">=") return actual >= expected;
  if (match[1] === "<=") return actual <= expected;
  if (match[1] === ">") return actual > expected;
  if (match[1] === "<") return actual < expected;
  return actual === expected;
}

function searchable(item: ArmorItem, context: GearSearchContext): string {
  return normalize([item.name, item.instanceId, item.slot, item.className, item.rarity, item.location, item.tag, item.archetype?.name, item.tunedStat, context.groupId, ...item.setBonuses.map((set) => set.name), ...item.perks.map((perk) => perk.name)].join(" "));
}
function tokenize(query: string): string[] { return query.match(/(?:[^\s"]+|"[^"]*")+/g) || []; }
function activeToken(query: string): string { return query.match(/(?:^|\s)(\S*)$/)?.[1] || ""; }
function unquote(value: string): string { return value.trim().replace(/^"|"$/g, ""); }
function normalize(value: unknown): string { return String(value || "").trim().toLowerCase(); }
function includes(actual: unknown, expected: string): boolean { return normalize(actual).includes(expected); }
function quoteValue(value?: string): string { const clean = String(value || "").trim(); return clean.includes(" ") ? `"${clean}"` : clean.toLowerCase(); }
function uniqueSuggestions(values: GearSearchSuggestion[]): GearSearchSuggestion[] { return [...new Map(values.filter((entry) => entry.value && !entry.value.endsWith(':""')).map((entry) => [entry.value.toLowerCase(), entry])).values()]; }
