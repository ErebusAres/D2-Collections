import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sourceUrl = "https://raw.githubusercontent.com/48klocs/dim-wish-list-sources/master/voltron.txt";
const inputArg = process.argv.find((value) => value.startsWith("--input="))?.slice(8);
const inputPath = inputArg || join(tmpdir(), "guardian-nexus-voltron.txt");
if (!inputArg) {
  const response = await fetch(sourceUrl, { headers: { "User-Agent": "Guardian-Nexus-rating-sync" } });
  if (!response.ok) throw new Error(`Wishlist download failed with HTTP ${response.status}.`);
  await writeFile(inputPath, Buffer.from(await response.arrayBuffer()));
}

const manifest = JSON.parse(await readFile(new URL("../apps/web/public/data/gear-manifest.json", import.meta.url), "utf8"));
const currentWeapons = new Set(Object.values(manifest.gearItemDefinitions || {}).filter((entry) => Number(entry.itemType) === 3).map((entry) => String(entry.hash)));
const text = await readFile(inputPath, "utf8");
const items = new Map();
let context = "";
for (const raw of text.split(/\r?\n/)) {
  const line = raw.trim();
  if (line.startsWith("title:")) context = line;
  else if (line.startsWith("//notes:")) context = line;
  else if (line.startsWith("description:")) context = `${context} ${line}`.slice(-12_000);
  if (!line.startsWith("dimwishlist:item=")) continue;
  const match = line.match(/^dimwishlist:item=(\d+)&perks=([\d,]+)/);
  if (!match || !currentWeapons.has(match[1])) continue;
  const modes = [...new Set([/\bpve\b/i.test(context) ? "pve" : "", /\bpvp\b/i.test(context) ? "pvp" : ""].filter(Boolean))];
  context = context.slice(-4_000);
  if (!modes.length) continue;
  const perks = match[2].split(",").filter(Boolean);
  if (perks.length < 2) continue;
  const item = items.get(match[1]) || { pve: bucket(), pvp: bucket() };
  for (const mode of modes) {
    item[mode].rolls += 1;
    perks.forEach((perk) => item[mode].perks.add(perk));
    item[mode].traitPairs.add(perks.slice(-2).join(","));
  }
  items.set(match[1], item);
}

const output = {
  schemaVersion: 2,
  reviewedAt: new Date().toISOString().slice(0, 10),
  source: { name: "DIM default community wishlist (Voltron)", url: sourceUrl, repository: "https://github.com/48klocs/dim-wish-list-sources", license: "MIT" },
  method: { individualPerkWeight: 50, recommendedTraitPairWeight: 50, note: "PvE and PvP coverage scores combine active perks appearing in curator recommendations with an exact match of the final two trait columns. Unknown means unreviewed, never bad." },
  items: Object.fromEntries([...items].sort(([a], [b]) => Number(a) - Number(b)).map(([hash, item]) => [hash, { pve: serialize(item.pve), pvp: serialize(item.pvp) }]))
};
await writeFile(new URL("../apps/web/public/data/weapon-value.v2.json", import.meta.url), `${JSON.stringify(output)}\n`);
console.log(`Wrote ${Object.keys(output.items).length} current weapon rating records from ${sourceUrl}.`);

function bucket() { return { rolls: 0, perks: new Set(), traitPairs: new Set() }; }
function serialize(value) { return { rolls: value.rolls, perks: [...value.perks].sort((a, b) => Number(a) - Number(b)), traitPairs: [...value.traitPairs].sort() }; }
