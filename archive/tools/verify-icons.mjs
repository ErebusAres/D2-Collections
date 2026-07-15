import fs from "node:fs";
import vm from "node:vm";

const sandbox = { window: {} };
sandbox.window.window = sandbox.window;

for (const file of [
  "data/catalog.js",
  "data/hunter-catalog.js",
  "data/year-8-catalog.js",
  "data/icon-map.js",
  "assets/static-icons.js"
]) {
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
}

const catalog = sandbox.window.D2_COLLECTIONS_CATALOG || { weapons: [], armor: {} };
const items = [
  ...(catalog.weapons || []).map(item => ({ ...item, kind: "weapon" })),
  ...Object.entries(catalog.armor || {}).flatMap(([className, list]) =>
    (Array.isArray(list) ? list : []).map(item => ({ ...item, kind: "armor", className }))
  )
];

const missing = items.filter(item => !item.icon && !item.iconUrl).map(item => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  className: item.className || ""
}));

console.log(`items=${items.length} missingIcons=${missing.length}`);
if (missing.length) {
  console.log(JSON.stringify(missing, null, 2));
  process.exitCode = 1;
}
