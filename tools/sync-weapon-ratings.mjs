import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const RATING_SOURCES = {
  voltron: {
    id: "voltron",
    name: "DIM Voltron community wishlist",
    url: "https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt",
    repository: "https://github.com/48klocs/dim-wish-list-sources",
    usedBy: ["DIM (default)", "Destiny Recipes"],
    note: "The shared default recommendation catalog used by DIM and loaded by Destiny Recipes."
  },
  "choosy-voltron": {
    id: "choosy-voltron",
    name: "Choosy Voltron",
    url: "https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/choosy_voltron.txt",
    repository: "https://github.com/48klocs/dim-wish-list-sources",
    usedBy: ["DIM (optional)"],
    note: "Voltron recommendations plus explicit negative weapon verdicts for a more opinionated DIM-style result."
  },
  "just-another-team": {
    id: "just-another-team",
    name: "Just Another Team (MnK)",
    url: "https://raw.githubusercontent.com/dsf000z/JAT-wishlists-bundler/main/bundles/DIM/just-another-team-mnk.txt",
    repository: "https://github.com/dsf000z/JAT-wishlists-bundler",
    usedBy: ["DIM (suggested option)"],
    note: "The current Just Another Team mouse-and-keyboard wishlist offered by DIM."
  }
};
export const SOURCE_URL = RATING_SOURCES.voltron.url;
export const ENHANCED_PERKS_URL = "https://raw.githubusercontent.com/DestinyItemManager/DIM/master/src/data/d2/trait-to-enhanced-trait.json";
export const COLUMN_WEIGHTS = [1, 1, 1, 1];

export function compileWeaponRatings(manifest, text, reviewedAt = new Date().toISOString().slice(0, 10), enhancedPerks = {}, source = RATING_SOURCES.voltron) {
  const definitions = Object.values(manifest.gearItemDefinitions || {}).filter((entry) => Number(entry.itemType) === 3);
  const currentWeapons = new Map(definitions.map((entry) => [String(entry.hash), {
    itemType: String(entry.itemTypeDisplayName || "Unknown weapon"),
    name: String(entry.displayProperties?.name || "").trim()
  }]));
  const items = new Map();
  let context = "";

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("//notes:")) { context = line; continue; }
    if (!line.startsWith("dimwishlist:item=")) { if (!line.startsWith("title:") && !line.startsWith("description:")) context = ""; continue; }
    const match = line.match(/^dimwishlist:item=(-?\d+)(?:&perks=([\d,]+))?/);
    if (!match) continue;
    const itemHash = match[1].replace(/^-/, "");
    if (!currentWeapons.has(itemHash)) continue;
    const item = items.get(itemHash) || { itemType: currentWeapons.get(itemHash).itemType, pve: bucket(), pvp: bucket() };
    if (match[1].startsWith("-")) {
      item.disliked = true;
      items.set(itemHash, item);
      continue;
    }
    const modeContext = context.match(/\|tags:(.*)$/i)?.[1] || context;
    const modes = [...new Set([/\bpve\b/i.test(modeContext) ? "pve" : "", /\bpvp\b/i.test(modeContext) ? "pvp" : ""].filter(Boolean))];
    if (!modes.length) continue;
    const perks = (match[2] || "").split(",").filter(Boolean);
    if (perks.length < 2) continue;
    const aligned = alignColumns(perks);
    for (const mode of modes) {
      item[mode].recommendations += 1;
      if (aligned[2] || aligned[3]) item[mode].traitPairs.add(`${aligned[2] || ""},${aligned[3] || ""}`);
      aligned.forEach((perk, index) => { if (perk) item[mode].columns[index].add(perk); });
    }
    items.set(itemHash, item);
  }

  const types = buildTypeProfiles(items);
  const families = buildFamilyProfiles(items, currentWeapons);
  const serializedItems = Object.fromEntries([...items].sort(([a], [b]) => Number(a) - Number(b)).map(([hash, item]) => [hash, {
    itemType: item.itemType,
    pve: serializeBucket(item.pve),
    pvp: serializeBucket(item.pvp),
    ...(item.disliked ? { disliked: true } : {})
  }]));
  const typeNames = [...new Set(definitions.map((entry) => String(entry.itemTypeDisplayName || "Unknown weapon")))].sort();

  return {
    schemaVersion: 4,
    reviewedAt,
    source: {
      id: source.id,
      name: source.name,
      url: source.url,
      repository: source.repository,
      usedBy: source.usedBy,
      note: source.note,
      license: "MIT",
      matchingLogic: "DIM selectable-socket matching with base/enhanced trait equivalence",
      matchingLogicUrl: ENHANCED_PERKS_URL
    },
    method: {
      columnWeights: COLUMN_WEIGHTS,
      tiers: { excellent: 90, strong: 75, mixed: 50, weak: 25 },
      note: "Exact scores preserve DIM-recommended trait pairings and compare every selectable option in the four wishlist perk columns with equal weight. Base and enhanced trait hashes are equivalent, matching DIM. Unreviewed reissues first use clearly labeled same-name weapon-family evidence, then broader weapon-type evidence; neither is presented as an item-specific review."
    },
    coverage: {
      manifestWeapons: definitions.length,
      reviewedWeapons: items.size,
      supportedTypes: typeNames.length,
      reviewedTypes: Object.keys(types).length
    },
    perkAliases: Object.fromEntries(Object.entries(enhancedPerks).map(([base, enhanced]) => [String(enhanced), String(base)]).sort(([a], [b]) => Number(a) - Number(b))),
    items: serializedItems,
    families,
    types
  };
}

function alignColumns(perks) {
  const result = [undefined, undefined, undefined, undefined];
  const start = Math.max(0, 4 - Math.min(4, perks.length));
  perks.slice(-4).forEach((perk, index) => { result[start + index] = perk; });
  return result;
}

function bucket() { return { recommendations: 0, columns: [new Set(), new Set(), new Set(), new Set()], traitPairs: new Set() }; }
function serializeBucket(value) { return { recommendations: value.recommendations, columns: value.columns.map((column) => [...column].sort((a, b) => Number(a) - Number(b))), traitPairs: [...value.traitPairs].sort() }; }

function buildTypeProfiles(items) {
  return buildProfiles(items, (hash, item) => item.itemType);
}

function buildFamilyProfiles(items, currentWeapons) {
  const manifestCounts = new Map();
  const reviewedCounts = new Map();
  for (const weapon of currentWeapons.values()) {
    const key = familyProfileKey(weapon.itemType, weapon.name);
    if (key) manifestCounts.set(key, (manifestCounts.get(key) || 0) + 1);
  }
  for (const [hash, item] of items) {
    const key = familyProfileKey(item.itemType, currentWeapons.get(hash)?.name || "");
    if (key) reviewedCounts.set(key, (reviewedCounts.get(key) || 0) + 1);
  }
  const useful = new Set([...manifestCounts].filter(([key, count]) => count > (reviewedCounts.get(key) || 0)).map(([key]) => key));
  return buildProfiles(items, (hash, item) => {
    const key = familyProfileKey(item.itemType, currentWeapons.get(hash)?.name || "");
    return useful.has(key) ? key : "";
  });
}

function familyProfileKey(itemType, name) {
  const normalizedName = name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return normalizedName ? `${itemType}::${normalizedName}` : "";
}

function buildProfiles(items, profileKey) {
  const profiles = new Map();
  for (const [hash, item] of items) {
    const key = profileKey(hash, item);
    if (!key) continue;
    const profile = profiles.get(key) || { pve: typeBucket(), pvp: typeBucket() };
    for (const mode of ["pve", "pvp"]) {
      if (!item[mode].recommendations) continue;
      profile[mode].weapons += 1;
      item[mode].columns.forEach((column, index) => column.forEach((perk) => profile[mode].columns[index].set(perk, (profile[mode].columns[index].get(perk) || 0) + 1)));
    }
    profiles.set(key, profile);
  }
  return Object.fromEntries([...profiles].sort(([a], [b]) => a.localeCompare(b)).map(([name, profile]) => [name, {
    pve: serializeTypeBucket(profile.pve),
    pvp: serializeTypeBucket(profile.pvp)
  }]));
}

function typeBucket() { return { weapons: 0, columns: [new Map(), new Map(), new Map(), new Map()] }; }
function serializeTypeBucket(value) {
  return {
    weapons: value.weapons,
    columns: value.columns.map((column) => {
      const maximum = Math.max(0, ...column.values());
      return Object.fromEntries([...column].sort(([a], [b]) => Number(a) - Number(b)).map(([perk, count]) => [perk, maximum ? Math.round(count / maximum * 100) : 0]));
    })
  };
}

export async function main() {
  const inputArg = process.argv.find((value) => value.startsWith("--input="))?.slice(8);
  const enhancedResponse = await fetch(ENHANCED_PERKS_URL, { headers: { "User-Agent": "Guardian-Nexus-rating-sync" } });
  if (!enhancedResponse.ok) throw new Error(`DIM enhanced-perk mapping download failed with HTTP ${enhancedResponse.status}.`);
  const enhancedPerks = await enhancedResponse.json();
  const manifest = JSON.parse(await readFile(new URL("../apps/web/public/data/gear-manifest.json", import.meta.url), "utf8"));
  const sources = inputArg ? [RATING_SOURCES.voltron] : Object.values(RATING_SOURCES);
  for (const source of sources) {
    const inputPath = inputArg || join(tmpdir(), `guardian-nexus-${source.id}.txt`);
    if (!inputArg) {
      const response = await fetch(source.url, { headers: { "User-Agent": "Guardian-Nexus-rating-sync" } });
      if (!response.ok) throw new Error(`${source.name} download failed with HTTP ${response.status}.`);
      await writeFile(inputPath, Buffer.from(await response.arrayBuffer()));
    }
    const text = await readFile(inputPath, "utf8");
    const output = compileWeaponRatings(manifest, text, new Date().toISOString().slice(0, 10), enhancedPerks, source);
    const filename = source.id === "voltron" ? "weapon-value.v4.json" : `weapon-value.${source.id}.v4.json`;
    await writeFile(new URL(`../apps/web/public/data/${filename}`, import.meta.url), `${JSON.stringify(output)}\n`);
    console.log(`Wrote ${output.coverage.reviewedWeapons}/${output.coverage.manifestWeapons} ${source.name} records to ${filename}.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
