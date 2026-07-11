import fs from "node:fs";
import vm from "node:vm";

const sandbox = { window: {} };
sandbox.window.window = sandbox.window;

for (const file of [
  "data/catalog.js",
  "data/hunter-catalog.js",
  "data/year-8-catalog.js",
  "data/bungie-collectible-map.js"
]) {
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
}

const catalog = sandbox.window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
const bungie = sandbox.window.D2_COLLECTIONS_BUNGIE_COLLECTIBLES || { items: {} };
const allItems = [
  ...(catalog.weapons || []).map(item => ({ ...item, kind: "weapon" })),
  ...Object.entries(catalog.armor || {}).flatMap(([className, list]) =>
    (Array.isArray(list) ? list : []).map(item => ({ ...item, kind: "armor", className }))
  )
];

const missingBungieSource = [];
const mismatchedSource = [];
const historicalManifestSource = [];

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isHistoricalSource(value) {
  return /\b(season pass|pre order|episode|season of|earned during|previous season)\b/.test(normalize(value));
}

for (const item of allItems) {
  const sourceStrings = bungie.items?.[item.id]?.sourceStrings || [];
  if (!sourceStrings.length) {
    missingBungieSource.push({ id: item.id, name: item.name, source: item.source });
    continue;
  }

  const catalogSource = normalize(item.source);
  const manifestSource = normalize(sourceStrings.join(" "));
  if (isHistoricalSource(manifestSource)) {
    historicalManifestSource.push({
      id: item.id,
      name: item.name,
      catalogSource: item.source,
      bungieSource: sourceStrings.join(" | ")
    });
  }
  const importantTokens = catalogSource.split(" ").filter(token => token.length >= 5);
  const overlap = importantTokens.some(token => manifestSource.includes(token));
  if (importantTokens.length && !overlap) {
    mismatchedSource.push({
      id: item.id,
      name: item.name,
      catalogSource: item.source,
      bungieSource: sourceStrings.join(" | ")
    });
  }
}

const result = {
  totalItems: allItems.length,
  missingBungieSource: missingBungieSource.length,
  mismatchedSource: mismatchedSource.length,
  historicalManifestSource: historicalManifestSource.length,
  historicalManifestSample: historicalManifestSource.slice(0, 30),
  mismatchedSample: mismatchedSource.slice(0, 30)
};

console.log(JSON.stringify(result, null, 2));
if (missingBungieSource.length) {
  console.log("Missing Bungie source sample:");
  console.log(JSON.stringify(missingBungieSource.slice(0, 30), null, 2));
}
