import fs from "node:fs/promises";
import vm from "node:vm";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("../data/icon-map.js", import.meta.url);
const BUNGIE_ROOT = "https://www.bungie.net";

function normalize(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[+’']/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function slotBucket(slot) {
  return {
    kinetic: 1498876634,
    energy: 2465295065,
    power: 953998645,
    helmet: 3448274439,
    gauntlets: 3551918588,
    chest: 14239492,
    legs: 20886954
  }[normalize(slot)];
}

const CLASS_TYPES = { titan: 0, hunter: 1, warlock: 2 };

async function readText(path) {
  return fs.readFile(new URL(path, ROOT), "utf8");
}

async function runCatalogPatch(context, path) {
  try {
    vm.runInContext(await readText(path), context, { filename: path });
  } catch {}
}

async function loadCatalog() {
  const context = { window: {} };
  vm.createContext(context);
  await runCatalogPatch(context, "data/catalog.js");
  await runCatalogPatch(context, "data/hunter-catalog.js");
  await runCatalogPatch(context, "data/year-8-catalog.js");
  return context.window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
}

function catalogItems(catalog) {
  return [
    ...(catalog.weapons || []).map(item => ({ ...item, kind: "weapon" })),
    ...Object.entries(catalog.armor || {}).flatMap(([className, list]) =>
      (Array.isArray(list) ? list : []).map(item => ({ ...item, kind: "armor", className }))
    )
  ];
}

function isRealItem(def, item) {
  const display = def.displayProperties || {};
  if (!display.name || !display.icon || display.hasIcon === false) return false;
  if (normalize(display.name) !== normalize(item.name)) return false;
  if (def.redacted) return false;
  if (item.kind === "weapon" && def.itemType !== 3) return false;
  if (item.kind === "armor" && def.itemType !== 2) return false;
  return true;
}

function score(def, item) {
  let points = 0;
  const bucket = slotBucket(item.slot);
  const categories = def.itemCategoryHashes || [];
  const icon = String(def.displayProperties?.icon || "").toLowerCase();

  if (bucket && def.inventory?.bucketTypeHash === bucket) points += 80;
  if (def.inventory?.tierType === 6 || def.inventory?.tierTypeName === "Exotic") points += 70;
  if (def.equippingBlock) points += 10;

  if (item.kind === "weapon") {
    points += def.itemType === 3 ? 50 : -100;
    if (def.itemSubTypeName && normalize(def.itemSubTypeName).includes(normalize(item.type))) points += 25;
    if (categories.includes(1)) points += 5;
  }

  if (item.kind === "armor") {
    points += def.itemType === 2 ? 50 : -100;
    if (def.classType === CLASS_TYPES[item.className]) points += 55;
    if (def.classType === 3) points -= 40;
    if (categories.includes(20)) points += 5;
  }

  if (icon.includes("collectible") || icon.includes("emblem") || icon.includes("record") || icon.includes("catalyst")) points -= 100;
  return points;
}

async function main() {
  const catalog = await loadCatalog();
  const items = catalogItems(catalog);
  const manifest = await fetch(`${BUNGIE_ROOT}/Platform/Destiny2/Manifest/`).then(res => res.json());
  const response = manifest.Response || manifest.response || manifest;
  const paths = response.jsonWorldComponentContentPaths || response.jsonWorldContentPaths || {};
  const en = paths.en || paths[Object.keys(paths)[0]] || {};
  const invPath = en.DestinyInventoryItemDefinition;
  if (!invPath) throw new Error("No DestinyInventoryItemDefinition path found in manifest");
  const definitionUrl = invPath.startsWith("http") ? invPath : `${BUNGIE_ROOT}${invPath}`;
  const definitions = await fetch(definitionUrl).then(res => res.json());

  const byName = new Map();
  for (const def of Object.values(definitions)) {
    const key = normalize(def.displayProperties?.name);
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(def);
  }

  const iconMap = {};
  const misses = [];
  for (const item of items) {
    const candidates = (byName.get(normalize(item.name)) || [])
      .filter(def => isRealItem(def, item))
      .map(def => ({ def, score: score(def, item) }))
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best && best.score > 75) iconMap[item.id] = best.def.displayProperties.icon;
    else misses.push({ id: item.id, name: item.name, kind: item.kind, slot: item.slot, candidates: candidates.length });
  }

  const output = `window.D2_COLLECTIONS_ICON_MAP = ${JSON.stringify(iconMap, null, 2)};\nwindow.D2_COLLECTIONS_ICON_AUDIT = ${JSON.stringify({ generatedAt: new Date().toISOString(), count: Object.keys(iconMap).length, misses }, null, 2)};\n`;
  await fs.writeFile(OUT, output, "utf8");
  console.log(`Generated ${Object.keys(iconMap).length} icons. Misses: ${misses.length}`);
}

main().catch(error => {
  console.warn("Icon map generation failed:", error);
  process.exitCode = 0;
});
