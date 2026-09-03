import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "apps/web/src");
const ignoredDirectories = new Set(["node_modules", "dist", ".git", ".wrangler", "coverage"]);

const dynamicClassValues = new Map([
  ["apps/web/src/components/gear/GearTagPicker.module.css", new Map([
    ["tag", ["all", "archive", "favorite", "infuse", "junk", "keep"]],
    ["selectedTag || value", ["all", "archive", "favorite", "infuse", "junk", "keep"]],
    ["option.tag || option.value", ["all", "archive", "favorite", "infuse", "junk", "keep"]],
  ])],
  ["apps/web/src/styles/journey/ProgressSummaryCard.module.css", new Map([
    ["tone", ["gold", "green", "violet"]],
  ])],
  ["apps/web/src/components/notifications/GuardianFeed.module.css", new Map([
    ["notification.priority", ["critical", "high", "normal", "low"]],
    ["config.animation", [
      "distortion", "crucible", "trials", "ironBanner", "gambit", "vanguard",
      "exotic", "legendary", "seasonal", "eververse", "bungieNews", "completion",
      "warning", "outage", "redemptionCode", "system",
    ]],
  ])],
  ["apps/web/src/pages/GuardianRankPage.module.css", new Map([
    ["rank.state", ["current", "future", "next", "previous"]],
  ])],
  ["apps/web/src/pages/Pages.module.css", new Map([
    ["entry.guide.confidence", ["verified", "partial", "pending"]],
  ])],
]);

function walk(directory) {
  const files = [];
  const stack = [directory];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  return files.sort();
}

function extractCssClasses(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const classes = new Set();
  for (const match of withoutComments.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
    classes.add(match[1]);
  }
  return classes;
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function templatePattern(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return { exact: node.text };
  if (!ts.isTemplateExpression(node)) return undefined;
  let pattern = `^${regexEscape(node.head.text)}`;
  for (const span of node.templateSpans) pattern += `.*${regexEscape(span.literal.text)}`;
  return { pattern: new RegExp(`${pattern}$`) };
}

function repositoryPath(absolutePath) {
  return path.relative(root, absolutePath).replaceAll(path.sep, "/");
}

const allFiles = walk(sourceRoot);
const sourceFiles = allFiles.filter((file) => /\.(?:ts|tsx)$/.test(file));
const cssModuleFiles = allFiles.filter((file) => file.endsWith(".module.css"));
const usage = new Map();

for (const cssFile of cssModuleFiles) {
  usage.set(cssFile, {
    classes: extractCssClasses(fs.readFileSync(cssFile, "utf8")),
    exact: new Set(),
    patterns: [],
    unknownDynamic: [],
    importers: new Set(),
  });
}

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const bindings = new Map();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleText = statement.moduleSpecifier.text;
    if (!moduleText.endsWith(".module.css")) continue;
    const local = statement.importClause?.name?.text;
    if (!local) continue;
    const cssFile = path.resolve(path.dirname(file), moduleText);
    const record = usage.get(cssFile);
    if (!record) continue;
    bindings.set(local, { cssFile, record });
    record.importers.add(repositoryPath(file));
  }

  if (bindings.size === 0) continue;

  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      bindings.get(node.expression.text)?.record.exact.add(node.name.text);
    }

    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const binding = bindings.get(node.expression.text);
      if (binding && node.argumentExpression) {
        const argument = node.argumentExpression;
        if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
          binding.record.exact.add(argument.text);
        } else {
          const template = templatePattern(argument);
          if (template?.exact) binding.record.exact.add(template.exact);
          else if (template?.pattern) binding.record.patterns.push(template.pattern);
          else {
            const expression = argument.getText(source);
            const knownValues = dynamicClassValues.get(repositoryPath(binding.cssFile))?.get(expression);
            if (knownValues) knownValues.forEach((className) => binding.record.exact.add(className));
            else binding.record.unknownDynamic.push({ expression, importer: repositoryPath(file) });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

const failures = [];
for (const [file, record] of [...usage.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const relative = repositoryPath(file);
  if (record.importers.size === 0) {
    failures.push(`${relative}: stylesheet has no TypeScript importer`);
    continue;
  }

  for (const dynamic of record.unknownDynamic) {
    failures.push(`${relative}: unrecognized dynamic key ${dynamic.expression} in ${dynamic.importer}`);
  }

  const unused = [...record.classes]
    .filter((className) => !record.exact.has(className))
    .filter((className) => !record.patterns.some((pattern) => pattern.test(className)))
    .sort();
  if (unused.length > 0) failures.push(`${relative}: unused classes ${unused.join(", ")}`);
}

if (failures.length > 0) {
  console.error("CSS module usage check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`CSS module usage verified across ${cssModuleFiles.length} stylesheets.`);
}
