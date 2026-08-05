import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const frontendRoot = path.join(root, "apps/web");
const sourceRoot = path.join(frontendRoot, "src");
const publicRoot = path.join(frontendRoot, "public");
const ignoredDirectories = new Set(["node_modules", "dist", ".git", ".wrangler", "coverage", "data"]);

function walk(directory, { ignoreData = false } = {}) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name) && (entry.name !== "data" || ignoreData)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  return files.sort();
}

function repositoryPath(absolutePath) {
  return path.relative(root, absolutePath).replaceAll(path.sep, "/");
}

const failures = [];
const sourceFiles = walk(sourceRoot);
const publicFiles = walk(publicRoot, { ignoreData: true });
const textSourceFiles = sourceFiles.filter((file) => /\.(?:ts|tsx|js|jsx|html)$/.test(file));
const sourceCorpus = textSourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

for (const file of sourceFiles) {
  if (/\.(?:js|jsx)$/.test(file)) failures.push(`${repositoryPath(file)}: frontend source must be TypeScript`);
}

for (const file of publicFiles) {
  if (/\.(?:js|jsx|ts|tsx|css)$/.test(file)) {
    failures.push(`${repositoryPath(file)}: executable or stylesheet source must pass through Vite`);
  }
}

for (const file of textSourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relative = repositoryPath(file);
  if (/\b[A-Z0-9_]+_CSS\s*=\s*String\.raw`/.test(source)) {
    failures.push(`${relative}: embedded CSS constants are not allowed`);
  }
  if (/<style(?:\s|>)/.test(source)) failures.push(`${relative}: inline style elements are not allowed`);
  if (/<link[^>]+rel=["']stylesheet["']/.test(source)) {
    failures.push(`${relative}: stylesheet links must use a Vite import and the shared loader`);
  }
}

const requiredFiles = [
  "apps/web/src/styles/loadStylesheet.ts",
  "apps/web/src/styles/guardian-fanfare.css",
];
for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`${relative}: required frontend source is missing`);
}

const forbiddenFiles = [
  ["apps/web/public/sw.js", "legacy public source must be removed"],
  ["apps/web/public/guardian-fanfare.css", "legacy public source must be removed"],
  [".github/workflows/remove-final-unused-css-once.yml", "one-shot cleanup workflow must not remain in the repository"],
  ["tools/remove-final-unused-css-once.mjs", "one-shot cleanup script must not remain in the repository"],
  ["tools/.final-css-trigger", "cleanup trigger marker must not remain in the repository"],
  ["tools/.final-css-pr-trigger", "cleanup trigger marker must not remain in the repository"],
];
for (const [relative, reason] of forbiddenFiles) {
  if (fs.existsSync(path.join(root, relative))) failures.push(`${relative}: ${reason}`);
}

for (const file of sourceFiles.filter((candidate) => candidate.endsWith(".css") && !candidate.endsWith(".module.css"))) {
  const basename = path.basename(file);
  if (!sourceCorpus.includes(basename)) failures.push(`${repositoryPath(file)}: global stylesheet has no Vite source reference`);
}

if (failures.length > 0) {
  console.error("Frontend source boundary check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Frontend source boundaries verified: React/Vite/TypeScript source only.");
}
