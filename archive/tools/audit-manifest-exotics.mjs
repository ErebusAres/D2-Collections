import fs from "node:fs";
import vm from "node:vm";

const API_KEY = "939b3c127bfc4ab5aa4e68093becbf30";
const API_ROOT = "https://www.bungie.net/Platform";
const BUNGIE_ROOT = "https://www.bungie.net";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function itemKind(item) {
  if (item.itemType === 2) return "armor";
  if ([3].includes(item.itemType)) return "weapon";
  return "";
}

function classNameFor(classType) {
  return ({ 0: "titan", 1: "hunter", 2: "warlock" })[classType] || "";
}

async function main() {
  const manifest = await bungieJson(`${API_ROOT}/Destiny2/Manifest/`);
  const paths = manifest.Response.jsonWorldComponentContentPaths.en;
  const [items, collectibles, buckets, damageTypes] = await Promise.all([
    bungieJson(`${BUNGIE_ROOT}${paths.DestinyInventoryItemDefinition}`),
    bungieJson(`${BUNGIE_ROOT}${paths.DestinyCollectibleDefinition}`),
    bungieJson(`${BUNGIE_ROOT}${paths.DestinyInventoryBucketDefinition}`),
    bungieJson(`${BUNGIE_ROOT}${paths.DestinyDamageTypeDefinition}`)
  ]);

  const catalog = loadCatalog();
  const catalogNames = new Set(catalog.map(item => normalize(item.name)));
  const seen = new Set();
  const missing = [];

  for (const item of Object.values(items)) {
    const name = item?.displayProperties?.name || "";
    const kind = itemKind(item);
    if (!name || !kind) continue;
    if (item.inventory?.tierType !== 6) continue;
    if (!item.collectibleHash) continue;
    if (!item.displayProperties?.icon) continue;
    if (catalogNames.has(normalize(name))) continue;

    const collectible = collectibles[String(item.collectibleHash)];
    const key = `${kind}:${item.classType}:${normalize(name)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    missing.push({
      id: slug(name),
      name,
      kind,
      className: kind === "armor" ? classNameFor(item.classType) : "",
      bucket: buckets[String(item.inventory?.bucketTypeHash)]?.displayProperties?.name || "",
      type: item.itemTypeDisplayName || "",
      element: (item.damageTypeHashes || [])
        .map(hash => damageTypes[String(hash)]?.displayProperties?.name)
        .filter(Boolean)
        .join(" / "),
      source: collectible?.sourceString || "",
      collectibleHash: String(item.collectibleHash),
      itemHash: String(item.hash)
    });
  }

  missing.sort((a, b) =>
    a.kind.localeCompare(b.kind) ||
    a.className.localeCompare(b.className) ||
    a.name.localeCompare(b.name)
  );

  console.log(JSON.stringify({
    manifestVersion: manifest.Response.version,
    catalogItems: catalog.length,
    missingCount: missing.length,
    missing
  }, null, 2));
  if (missing.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
