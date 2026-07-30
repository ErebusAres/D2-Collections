import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "apps/web/src");
const ignoredDirectories = new Set(["node_modules", "dist", ".git", ".wrangler", "coverage"]);

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
    if (!match[1].startsWith("module")) classes.add(match[1]);
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

function resolveCssImport(sourceFile, moduleText) {
  return path.resolve(path.dirname(sourceFile), moduleText);
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
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const bindings = new Map();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const moduleText = statement.moduleSpecifier.text;
    if (!moduleText.endsWith(".module.css")) continue;
    const local = statement.importClause?.name?.text;
    if (!local) continue;
    const cssFile = resolveCssImport(file, moduleText);
    const record = usage.get(cssFile);
    if (!record) continue;
    bindings.set(local, record);
    record.importers.add(path.relative(root, file).replaceAll(path.sep, "/"));
  }

  if (bindings.size === 0) continue;

  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const record = bindings.get(node.expression.text);
      if (record) record.exact.add(node.name.text);
    }

    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const record = bindings.get(node.expression.text);
      if (record && node.argumentExpression) {
        const argument = node.argumentExpression;
        if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
          record.exact.add(argument.text);
        } else {
          const template = templatePattern(argument);
          if (template?.exact) record.exact.add(template.exact);
          else if (template?.pattern) record.patterns.push(template.pattern);
          else record.unknownDynamic.push(argument.getText(source));
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

let provablyUnusedCount = 0;
let unsafeModuleCount = 0;
console.log("TYPESCRIPT-AWARE CSS MODULE USAGE");
for (const [file, record] of [...usage.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  const unused = [...record.classes]
    .filter((className) => !record.exact.has(className))
    .filter((className) => !record.patterns.some((pattern) => pattern.test(className)))
    .sort();
  if (record.unknownDynamic.length > 0) {
    unsafeModuleCount += 1;
    console.log(`\n${relative}`);
    console.log(`  dynamic keys prevent safe deletion: ${[...new Set(record.unknownDynamic)].join(", ")}`);
    console.log(`  unresolved classes: ${unused.join(", ") || "none"}`);
    continue;
  }
  if (unused.length === 0) continue;
  provablyUnusedCount += unused.length;
  console.log(`\n${relative}`);
  console.log(`  importers: ${[...record.importers].join(", ") || "none"}`);
  console.log(`  provably unused: ${unused.join(", ")}`);
}
console.log("");
console.log(`Modules with unknown dynamic keys: ${unsafeModuleCount}`);
console.log(`Provably unused CSS module classes: ${provablyUnusedCount}`);
