import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["apps", "packages"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".html", ".json"]);
const forbidden = /(?:from\s*|import\s*\(|require\s*\(|fetch\s*\(|readFile\s*\()[^\n;]*["'`](?:\.\.\/)*archive[\\/]/i;
const violations = [];

for (const root of roots) await scan(root);

if (violations.length) {
  console.error("Active source must not import or read archived application files:");
  for (const file of violations) console.error(`- ${file}`);
  process.exitCode = 1;
} else {
  console.log("Archive boundary verified.");
}

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (sourceExtensions.has(extname(entry.name)) && forbidden.test(await readFile(path, "utf8"))) violations.push(relative(".", path));
  }
}
