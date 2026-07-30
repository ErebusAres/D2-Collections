import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["apps/web/src", "apps/web/public"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".html"]);
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
    if (!selector || !declarations || selector.startsWith("@") || /^(from|to|\d+%|\d+%,)/.test(selector)) continue;
    rules.push({ selector, declarations, propertyCount: declarations.split(";").length });
  }
  return rules;
}

function extractClassSelectors(css) {
  const classes = new Set();
  const clean = stripCssComments(css);
  for (const match of clean.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) classes.add(match[1]);
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
const cssFiles = allFiles.filter((file) => path.extname(file) === ".css");
const sourceFiles = allFiles.filter((file) => sourceExtensions.has(path.extname(file)));
const legacyJsFiles = allFiles.filter((file) => [".js", ".jsx"].includes(path.extname(file)));
const sourceCorpus = sourceFiles
  .map((file) => `\n/* FILE:${file} */\n${fs.readFileSync(path.join(root, file), "utf8")}`)
  .join("\n");

const cssInventory = [];
const unusedClassCandidates = [];
const duplicateSelectors = [];
const sameFileDeclarationGroups = [];
const orphanCssCandidates = [];

for (const file of cssFiles) {
  const absolute = path.join(root, file);
  const css = fs.readFileSync(absolute, "utf8");
  const rules = extractRules(css);
  const classes = extractClassSelectors(css);
  cssInventory.push({ file, bytes: Buffer.byteLength(css), rules: rules.length, classes: classes.length });

  const bySelector = new Map();
  const byDeclarations = new Map();
  for (const rule of rules) {
    const selectorRules = bySelector.get(rule.selector) ?? [];
    selectorRules.push(rule.declarations);
    bySelector.set(rule.selector, selectorRules);

    if (rule.propertyCount >= 2 && rule.declarations.length >= 30) {
      const declarationRules = byDeclarations.get(rule.declarations) ?? [];
      declarationRules.push(rule.selector);
      byDeclarations.set(rule.declarations, declarationRules);
    }
  }

  for (const [selector, declarations] of bySelector) {
    if (declarations.length > 1) duplicateSelectors.push({ file, selector, declarations });
  }
  for (const [declarations, selectors] of byDeclarations) {
    if (selectors.length > 1) sameFileDeclarationGroups.push({ file, declarations, selectors });
  }

  for (const className of classes) {
    if (countOccurrences(sourceCorpus, className) === 0) unusedClassCandidates.push({ file, className });
  }

  const basename = path.basename(file);
  if (!sourceCorpus.includes(basename) && !file.startsWith("apps/web/public/")) orphanCssCandidates.push(file);
}

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

console.log("CSS FILES WITHOUT A SOURCE IMPORT CANDIDATE");
console.log("Public stylesheets are excluded because they may be linked by URL.");
if (orphanCssCandidates.length === 0) console.log("none");
else orphanCssCandidates.forEach((file) => console.log(file));
console.log("");

console.log("DUPLICATE SELECTOR DEFINITIONS");
console.log(`Candidates: ${duplicateSelectors.length}`);
for (const candidate of duplicateSelectors) {
  console.log(`\n${candidate.file} :: ${candidate.selector}`);
  candidate.declarations.forEach((declarations, index) => console.log(`  [${index + 1}] ${declarations}`));
}
console.log("");

console.log("SAME-FILE IDENTICAL MULTI-PROPERTY DECLARATIONS");
console.log(`Groups: ${sameFileDeclarationGroups.length}`);
for (const group of sameFileDeclarationGroups) {
  console.log(`\n${group.file} :: ${group.declarations}`);
  group.selectors.forEach((selector) => console.log(`  ${selector}`));
}
console.log("");

console.log("UNREFERENCED CLASS-NAME CANDIDATES");
console.log("Heuristic only: computed CSS-module keys and CSS-only state classes require manual review.");
console.log(`Candidates: ${unusedClassCandidates.length}`);
for (const candidate of unusedClassCandidates) console.log(`${candidate.file} :: .${candidate.className}`);
