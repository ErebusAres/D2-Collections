import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const SOURCE_URL = "https://raw.githubusercontent.com/Manaiakalani/destiny-code-finder/main/public/data/emblems.json";
const SOURCE_PAGE = "https://github.com/Manaiakalani/destiny-code-finder/blob/main/public/data/emblems.json";
const CATALOG_PATH = resolve("apps/web/src/rewardCodesCatalog.json");
const CODE_PATTERN = /^[A-Z0-9]{3}(?:-[A-Z0-9]{3}){2}$/;
const MAX_NEW_CODES_PER_RUN = 25;

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

export function inferRewardCodeKind(reward, definitions = {}) {
  const definition = definitions[reward];
  const note = definition && typeof definition === "object" ? String(definition.note || "") : "";
  const detail = note.toLowerCase();
  if (/ornament|armor set/.test(detail) || /ornament set$/i.test(reward)) return "Ornament";
  if (/ghost(?: shell)?/.test(detail)) return "Ghost Shell";
  if (/transmat/.test(detail)) return "Transmat";
  if (/emote/.test(detail)) return "Emote";
  if (/shader/.test(detail)) return "Shader";
  if (/sparrow/.test(detail)) return "Sparrow";
  if (/\bship\b/.test(detail)) return "Ship";
  return "Emblem";
}

export function mergeRewardCodes(existingCatalog, upstream) {
  if (!Array.isArray(existingCatalog)) throw new Error("The local reward-code catalog must be an array.");
  const payload = requireObject(upstream, "Upstream reward-code payload");
  const sourceCodes = requireObject(payload.codeToEmblem, "Upstream codeToEmblem");
  const definitions = requireObject(payload.emblems || {}, "Upstream emblems");
  const verifiedAt = String(payload.lastUpdated || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) || Number.isNaN(Date.parse(`${verifiedAt}T00:00:00Z`))) {
    throw new Error("Upstream lastUpdated must be a valid ISO date.");
  }
  const existingCodes = new Set(existingCatalog.map((entry) => String(entry.code || "").toUpperCase()));
  const discovered = [];

  for (const [rawCode, rawReward] of Object.entries(sourceCodes)) {
    const code = rawCode.trim().toUpperCase();
    const reward = String(rawReward || "").trim();
    if (!CODE_PATTERN.test(code)) throw new Error(`Rejected malformed upstream reward code: ${rawCode}`);
    if (!reward || reward.length > 160) throw new Error(`Rejected invalid reward name for ${code}.`);
    if (existingCodes.has(code)) continue;
    existingCodes.add(code);
    discovered.push({
      code,
      reward,
      kind: inferRewardCodeKind(reward, definitions),
      verifiedAt,
      sourceUrl: SOURCE_PAGE
    });
  }

  if (discovered.length > MAX_NEW_CODES_PER_RUN) {
    throw new Error(`Rejected an unexpected catalog increase of ${discovered.length} codes (limit ${MAX_NEW_CODES_PER_RUN}).`);
  }

  discovered.sort((left, right) => left.reward.localeCompare(right.reward));
  return { catalog: [...discovered, ...existingCatalog], discovered };
}

async function fetchUpstream() {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(SOURCE_URL, {
        headers: { Accept: "application/json", "User-Agent": "Guardian-Nexus-Reward-Code-Sync/1.0" },
        signal: AbortSignal.timeout(30_000)
      });
      if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}.`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolveDelay) => setTimeout(resolveDelay, 2 ** attempt * 1_000));
    }
  }
  throw lastError;
}

async function main() {
  const existingCatalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const upstream = await fetchUpstream();
  if (Object.keys(requireObject(upstream.codeToEmblem, "Upstream codeToEmblem")).length < 50) {
    throw new Error("Rejected an unexpectedly small upstream reward-code catalog.");
  }
  const { catalog, discovered } = mergeRewardCodes(existingCatalog, upstream);
  if (!discovered.length) {
    console.log(`Reward-code catalog is current (${existingCatalog.length} codes; checked ${new Date().toISOString()}).`);
    return;
  }

  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Added ${discovered.length} verified reward code(s): ${discovered.map((entry) => entry.code).join(", ")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
