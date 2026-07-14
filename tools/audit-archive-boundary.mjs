import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const roots = ["apps", "packages", "tools"];
const checkedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".json", ".py"]);
const violations = [];

async function walk(relative) {
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", "coverage"].includes(entry.name)) await walk(child);
      continue;
    }
    if (!checkedExtensions.has(path.extname(entry.name)) || child.endsWith("audit-archive-boundary.mjs")) continue;
    const source = await readFile(path.join(root, child), "utf8");
    const patterns = [
      /(?:from|import|require|fetch|readFile|readFileSync|new URL)\s*\(?\s*["'`]([^"'`]*[\\/]archive[\\/][^"'`]*)/gi,
      /(?:src|href)\s*=\s*["'`][^"'`]*[\\/]archive[\\/]/gi
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) violations.push(`${child}: ${match[0]}`);
    }
  }
}

for (const relative of roots) await walk(relative);
if (violations.length) {
  process.stderr.write(`Active source crosses the archive boundary:\n${violations.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Archive boundary verified: active source has no imports or asset reads from archive/.\n");
