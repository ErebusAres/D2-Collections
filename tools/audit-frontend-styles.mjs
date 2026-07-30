import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["apps/web/src", "apps/web/public"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".html"]);
const cssExtensions = new Set([".css"]);
const ignoredDirectories = new Set(["node_modules", "dist", ".git", ".wrangler", "coverage"]);

function walk(relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];

  const files = [];
  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile()) files.push(path.relative(root, absolute).replaceAll(path.sep, "/"));
    }
  }
  return files.sort();
}

function stripCssComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
}

function normalizeDeclarations(value) {
  return value
    .split(";")
    .map((part) => part.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort()
    .join(";");
}

function extractRules(css) {
  const clean = stripCssComments(css);
  const rules = [];
  const matcher = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = matcher.exec(clean)) !== null) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const declarations = normalizeDeclarations(match[2]);
    if (!selector || !declarations || selector.startsWith("@")) continue;
    rules.push({ selector, declarations });
  }
  return rules;
}

function extractClassSelectors(css) {
  const classes = new Set();
  const clean = stripCssComments(css);
  for (const match of clean.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
    classes.add(match[1]);
  }
  return [...classes].sort();
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = haystack.indexOf(needle, cursor)) !== -1) {
    count += 1;
    cursor += needle.length;
  }
  return count;
}

const allFiles = scanRoots.flatMap(walk);
const cssFiles = allFiles.filter((file) => cssExtensions.has(path.extname(file)));
const sourceFiles = allFiles.filter((file) => sourceExtensions.has(path.extname(file)));
const legacyJsFiles = allFiles.filter((file) => [".js", ".jsx"].includes(path.extname(file)));
const sourceCorpus = sourceFiles
  .map((file) => `\n/* FILE:${file} */\n${fs.readFileSync(path.join(root, file), "utf8")}`)
  .join("\n");

const declarationsToRules = new Map();
const cssInventory = [];
const unusedClassCandidates = [];

for (const file of cssFiles) {
  const absolute = path.join(root, file);
  const css = fs.readFileSync(absolute, "utf8");
  const rules = extractRules(css);
  const classes = extractClassSelectors(css);

  cssInventory.push({
    file,
    bytes: Buffer.byteLength(css),
    rules: rules.length,
    classes: classes.length,
  });

  for (const rule of rules) {
    const entries = declarationsToRules.get(rule.declarations) ?? [];
    entries.push({ file, selector: rule.selector });
    declarationsToRules.set(rule.declarations, entries);
  }

  for (const className of classes) {
    const plainCount = countOccurrences(sourceCorpus, className);
    if (plainCount === 0) unusedClassCandidates.push({ file, className });
  }
}

const duplicateGroups = [...declarationsToRules.entries()]
  .map(([declarations, entries]) => ({ declarations, entries }))
  .filter(({ entries }) => entries.length > 1)
  .sort((a, b) => b.entries.length - a.entries.length || a.entries[0].file.localeCompare(b.entries[0].file));

console.log("FRONTEND STYLE / TYPESCRIPT INVENTORY");
console.log(`Scanned roots: ${scanRoots.join(", ")}`);
console.log(`CSS files: ${cssFiles.length}`);
console.log(`Source files: ${sourceFiles.length}`);
console.log(`Legacy .js/.jsx frontend files: ${legacyJsFiles.length}`);
console.log("");

console.log("CSS FILES");
for (const item of cssInventory.sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file))) {
  console.log(`${item.bytes.toString().padStart(7)} bytes | ${item.rules.toString().padStart(4)} rules | ${item.classes.toString().padStart(4)} classes | ${item.file}`);
}
console.log("");

console.log("LEGACY FRONTEND JAVASCRIPT");
if (legacyJsFiles.length === 0) console.log("none");
else legacyJsFiles.forEach((file) => console.log(file));
console.log("");

console.log("IDENTICAL DECLARATION GROUPS (2+ RULES)");
console.log(`Groups: ${duplicateGroups.length}`);
for (const [index, group] of duplicateGroups.entries()) {
  console.log(`\n[${index + 1}] ${group.declarations}`);
  for (const entry of group.entries) console.log(`  ${entry.file} :: ${entry.selector}`);
}
console.log("");

console.log("UNREFERENCED CLASS-NAME CANDIDATES");
console.log("Heuristic only: dynamic selector construction and CSS-only state classes require manual review.");
console.log(`Candidates: ${unusedClassCandidates.length}`);
for (const candidate of unusedClassCandidates) console.log(`${candidate.file} :: .${candidate.className}`);
