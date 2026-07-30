import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const unusedByFile = new Map([
  ["apps/web/src/pages/Builds.module.css", new Set([
    "artifactSlotPips",
    "artifactTier",
    "artifactTiers",
    "buildOverview",
    "equipmentNoRoll",
    "equipmentPerks",
    "equipmentRollNote",
    "modQuantity",
    "notesConceptEditor",
    "overviewChips",
    "overviewEntries",
    "overviewEntry",
    "overviewGuide",
    "overviewLoop",
    "overviewMeta",
    "overviewSection",
    "overviewStats",
    "quickConcepts"
  ])],
  ["apps/web/src/pages/JourneyTrackers.module.css", new Set(["unavailable"])],
  ["apps/web/src/pages/QuestsPage.module.css", new Set(["bountySection", "inspectUnavailable"])]
]);

function splitPrefix(prelude) {
  let index = 0;
  while (index < prelude.length) {
    if (/\s/.test(prelude[index])) {
      index += 1;
      continue;
    }
    if (prelude.startsWith("/*", index)) {
      const end = prelude.indexOf("*/", index + 2);
      if (end < 0) break;
      index = end + 2;
      continue;
    }
    break;
  }
  return { prefix: prelude.slice(0, index), selector: prelude.slice(index) };
}

function splitSelectors(value) {
  const selectors = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = "";
  let comment = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (comment) {
      if (character === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets = Math.max(0, brackets - 1);
    else if (character === "," && parentheses === 0 && brackets === 0) {
      selectors.push(value.slice(start, index));
      start = index + 1;
    }
  }
  selectors.push(value.slice(start));
  return selectors;
}

function findNextBoundary(source, start) {
  let parentheses = 0;
  let brackets = 0;
  let quote = "";
  let comment = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (comment) {
      if (character === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets = Math.max(0, brackets - 1);
    else if (parentheses === 0 && brackets === 0 && (character === "{" || character === ";")) return index;
  }
  return -1;
}

function findClosingBrace(source, openIndex) {
  let depth = 1;
  let quote = "";
  let comment = false;
  for (let index = openIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (comment) {
      if (character === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`Unbalanced CSS block at ${openIndex}`);
}

function selectorUsesUnusedClass(selector, unused) {
  for (const match of selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
    if (unused.has(match[1])) return true;
  }
  return false;
}

function transformContainer(source, unused, insideKeyframes = false) {
  let output = "";
  let cursor = 0;
  while (cursor < source.length) {
    const boundary = findNextBoundary(source, cursor);
    if (boundary < 0) {
      output += source.slice(cursor);
      break;
    }
    if (source[boundary] === ";") {
      output += source.slice(cursor, boundary + 1);
      cursor = boundary + 1;
      continue;
    }

    const prelude = source.slice(cursor, boundary);
    const close = findClosingBrace(source, boundary);
    const body = source.slice(boundary + 1, close);
    const { prefix, selector } = splitPrefix(prelude);
    const trimmed = selector.trim();

    if (insideKeyframes) {
      output += `${prelude}{${body}}`;
    } else if (trimmed.startsWith("@")) {
      const keyframes = /^@(?:-webkit-)?keyframes\b/i.test(trimmed);
      const nested = /^@(media|supports|container|layer|scope|document)\b/i.test(trimmed);
      const nextBody = nested ? transformContainer(body, unused, false) : body;
      output += `${prelude}{${keyframes ? body : nextBody}}`;
    } else {
      const remaining = splitSelectors(selector)
        .filter((entry) => !selectorUsesUnusedClass(entry, unused));
      if (remaining.length > 0) output += `${prefix}${remaining.join(",")}{${body}}`;
      else output += prefix;
    }
    cursor = close + 1;
  }
  return output;
}

function removeOrphanKeyframes(source) {
  let output = source;
  let changed = true;
  while (changed) {
    changed = false;
    let cursor = 0;
    while (cursor < output.length) {
      const match = /@(?:-webkit-)?keyframes\s+([-_a-zA-Z][-_a-zA-Z0-9]*)\s*\{/g;
      match.lastIndex = cursor;
      const found = match.exec(output);
      if (!found) break;
      const open = output.indexOf("{", found.index);
      const close = findClosingBrace(output, open);
      const name = found[1];
      const references = [...output.matchAll(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "g"))].length;
      if (references === 1) {
        output = `${output.slice(0, found.index)}${output.slice(close + 1)}`;
        changed = true;
        break;
      }
      cursor = close + 1;
    }
  }
  return output;
}

let removedBytes = 0;
for (const [relativePath, unused] of unusedByFile) {
  const file = path.join(root, relativePath);
  const before = fs.readFileSync(file, "utf8");
  const after = removeOrphanKeyframes(transformContainer(before, unused));
  if (after === before) throw new Error(`No CSS was removed from ${relativePath}`);
  removedBytes += Buffer.byteLength(before) - Buffer.byteLength(after);
  fs.writeFileSync(file, after);
  console.log(`${relativePath}: removed ${Buffer.byteLength(before) - Buffer.byteLength(after)} bytes`);
}

console.log(`Removed ${removedBytes} verified unused CSS bytes.`);
