import { readFile, readdir, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "apps", "web", "dist");
const html = await readFile(path.join(dist, "index.html"), "utf8");
const entryName = html.match(/src="\/assets\/(index-[^"]+\.js)"/)?.[1];
const styleName = html.match(/href="\/assets\/(index-[^"]+\.css)"/)?.[1];
if (!entryName || !styleName) throw new Error("Unable to identify the Guardian Nexus entry assets.");

const limits = {
  entryBytes: 375_000,
  entryGzipBytes: 115_000,
  entryCssBytes: 40_000,
  routeChunkBytes: 100_000
};
const entry = await readFile(path.join(dist, "assets", entryName));
const entryCss = await stat(path.join(dist, "assets", styleName));
const assets = await readdir(path.join(dist, "assets"));
const oversizedRoutes = [];
for (const name of assets.filter((name) => name.endsWith(".js") && name !== entryName)) {
  const details = await stat(path.join(dist, "assets", name));
  if (details.size > limits.routeChunkBytes) oversizedRoutes.push(`${name} (${details.size.toLocaleString()} bytes)`);
}

const failures = [];
if (entry.byteLength > limits.entryBytes) failures.push(`entry JavaScript is ${entry.byteLength.toLocaleString()} bytes; limit ${limits.entryBytes.toLocaleString()}`);
const gzipBytes = gzipSync(entry).byteLength;
if (gzipBytes > limits.entryGzipBytes) failures.push(`entry JavaScript gzip is ${gzipBytes.toLocaleString()} bytes; limit ${limits.entryGzipBytes.toLocaleString()}`);
if (entryCss.size > limits.entryCssBytes) failures.push(`entry CSS is ${entryCss.size.toLocaleString()} bytes; limit ${limits.entryCssBytes.toLocaleString()}`);
if (oversizedRoutes.length) failures.push(`route chunks exceed ${limits.routeChunkBytes.toLocaleString()} bytes: ${oversizedRoutes.join(", ")}`);
if (failures.length) throw new Error(`Guardian Nexus performance budget failed:\n- ${failures.join("\n- ")}`);

console.log(`Performance budgets verified: ${entry.byteLength.toLocaleString()} B JS (${gzipBytes.toLocaleString()} B gzip), ${entryCss.size.toLocaleString()} B CSS.`);
