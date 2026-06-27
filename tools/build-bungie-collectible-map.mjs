import fs from "node:fs";
import vm from "node:vm";

const API_KEY = "939b3c127bfc4ab5aa4e68093becbf30";
const API_ROOT = "https://www.bungie.net/Platform";
const BUNGIE_ROOT = "https://www.bungie.net";
const OUT_FILE = "data/bungie-collectible-map.js";
const OUT_ICON_FILE = "data/icon-map.js";
const NAME_ALIASES = {
  doomfangpauldrons: "doomfangpauldron"
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function loadCatalog() {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  for (const file of ["data/catalog.js", "data/hunter-catalog.js", "data/year-8-catalog.js"]) {
    vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }
  const catalog = sandbox.window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
  return [
    ...(catalog.weapons || []).map(item => ({ ...item, kind: "weapon" })),
    ...Object.entries(catalog.armor || {}).flatMap(([className, list]) =>
      (Array.isArray(list) ? list : []).map(item => ({ ...item, kind: "armor", className }))
    )
  ];
}

async function bungieJson(url) {
  const response = await fetch(url, { headers: { "X-API-Key": API_KEY } });
  if (!response.ok) throw new Error(`${url} failed HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const manifest = await bungieJson(`${API_ROOT}/Destiny2/Manifest/`);
  const paths = manifest.Response.jsonWorldComponentContentPaths.en;
  const [items, collectibles, records] = await Promise.all([
    bungieJson(`${BUNGIE_ROOT}${paths.DestinyInventoryItemDefinition}`),
    bungieJson(`${BUNGIE_ROOT}${paths.DestinyCollectibleDefinition}`),
    bungieJson(`${BUNGIE_ROOT}${paths.DestinyRecordDefinition}`)
  ]);

  const collectibleByItemHash = new Map();
  for (const [collectibleHash, collectible] of Object.entries(collectibles)) {
    const itemHash = collectible?.itemHash;
    if (itemHash !== undefined && itemHash !== null) {
      const list = collectibleByItemHash.get(String(itemHash)) || [];
      list.push(String(collectibleHash));
      collectibleByItemHash.set(String(itemHash), list);
    }
  }

  const manifestByName = new Map();
  for (const [itemHash, item] of Object.entries(items)) {
    const name = item?.displayProperties?.name;
    if (!name || item?.inventory?.tierType !== 6) continue;
    const hashes = [
      item.collectibleHash,
      ...(collectibleByItemHash.get(String(item.hash || itemHash)) || [])
    ].filter(value => value !== undefined && value !== null).map(String);
    if (!hashes.length) continue;
    const key = normalize(name);
    const list = manifestByName.get(key) || [];
    list.push({
      itemHash: String(item.hash || itemHash),
      collectibleHashes: [...new Set(hashes)],
      classType: Number(item.classType),
      itemType: Number(item.itemType),
      itemTypeDisplayName: item.itemTypeDisplayName || "",
      icon: item.displayProperties?.icon || "",
      name
    });
    manifestByName.set(key, list);
  }

  const classTypeForArmor = { titan: 0, hunter: 1, warlock: 2 };
  const output = {};
  const icons = {};
  const unresolved = [];
  const catalog = loadCatalog();
  const catalogByName = new Map(catalog.map(item => [normalize(item.name), item]));
  const catalystRecordHashes = {};

  for (const [recordHash, record] of Object.entries(records)) {
    const recordName = record?.displayProperties?.name || "";
    const normalizedRecord = normalize(recordName);
    if (!normalizedRecord.endsWith("catalyst")) continue;
    const itemName = normalizedRecord.slice(0, -"catalyst".length);
    const item = catalogByName.get(itemName) || catalogByName.get(NAME_ALIASES[itemName]);
    if (!item || item.kind !== "weapon") continue;
    catalystRecordHashes[item.id] = catalystRecordHashes[item.id] || [];
    catalystRecordHashes[item.id].push(String(record.hash || recordHash));
  }

  for (const item of catalog) {
    const normalizedName = normalize(item.name);
    const matches = manifestByName.get(normalizedName) || manifestByName.get(NAME_ALIASES[normalizedName]) || [];
    const filtered = item.kind === "armor"
      ? matches.filter(match => match.itemType === 2 && (match.classType === classTypeForArmor[item.className] || match.classType === 3))
      : matches.filter(match => match.itemType !== 2);
    const chosen = filtered.length ? filtered : matches;
    const collectibleHashes = [...new Set(chosen.flatMap(match => match.collectibleHashes))];
    if (collectibleHashes.length) {
      output[item.id] = { collectibleHashes };
      if (catalystRecordHashes[item.id]) output[item.id].catalystRecordHashes = [...new Set(catalystRecordHashes[item.id])];
      const icon = chosen.find(match => match.icon)?.icon || "";
      if (icon) icons[item.id] = icon;
    } else {
      unresolved.push({ id: item.id, name: item.name, kind: item.kind, className: item.className || "" });
    }
  }

  const content = [
    "window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES = ",
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      manifestVersion: manifest.Response.version,
      items: output,
      unresolved
    }, null, 2),
    ";\n"
  ].join("");
  fs.writeFileSync(OUT_FILE, content);
  const iconContent = [
    "window.D2_COLLECTIONS_ICON_MAP = ",
    JSON.stringify(icons, null, 2),
    ";\n"
  ].join("");
  fs.writeFileSync(OUT_ICON_FILE, iconContent);
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`Wrote ${OUT_ICON_FILE}`);
  console.log(`mapped=${Object.keys(output).length} icons=${Object.keys(icons).length} catalystRecords=${Object.keys(catalystRecordHashes).length} unresolved=${unresolved.length}`);
  if (unresolved.length) console.log(JSON.stringify(unresolved.slice(0, 30), null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
