import type {
  CompactManifest,
  GuardianNotification,
  HappeningCard,
  NotificationCategory,
  NotificationPriority
} from "@guardian-nexus/contracts";
import { imageUrl } from "@guardian-nexus/domain";
import { bungieGet, loadActivityManifest, loadQuestManifest } from "./bungie";
import type { Env } from "./types";

const MILESTONE_TTL_MS = 5 * 60_000;
const ALERT_TTL_MS = 5 * 60_000;
const NEWS_TTL_MS = 15 * 60_000;
const BUNGIE_NEWS_ROOT = "https://www.bungie.net";

interface CachedCards {
  cards: HappeningCard[];
  observedAt: string;
}

interface SnapshotRow {
  payload_json: string;
  observed_at: string;
  expires_at: string;
}

interface ActivityClassification {
  key: string;
  label: string;
  section: HappeningCard["section"];
  category: NotificationCategory;
  priority: NotificationPriority;
}

export async function readPublicWorldCards(env: Env, force = false): Promise<HappeningCard[]> {
  const results = await Promise.all([
    cachedCards(env, "public-milestones", MILESTONE_TTL_MS, loadMilestoneCards, force),
    cachedCards(env, "bungie-global-alerts", ALERT_TTL_MS, loadAlertCards, force),
    cachedCards(env, "bungie-news", NEWS_TTL_MS, loadNewsCards, force)
  ]);
  return collapseRepeatedActivities(deduplicateCards(results.flatMap((result) => result.cards)));
}

export async function refreshPublicWorldState(env: Env): Promise<void> {
  await readPublicWorldCards(env, true);
}

export function notificationsFromWorldCards(cards: HappeningCard[], now = new Date()): GuardianNotification[] {
  return cards
    .filter((card) => card.state !== "unavailable" && card.state !== "stale" && card.state !== "inactive")
    .map((card) => ({
      id: `world:${card.id}:${card.startsAt || card.observedAt || "current"}`,
      eventKey: `world:${card.id}`,
      type: card.id.split(":")[0] || "world-update",
      category: card.category,
      scope: "global",
      priority: card.priority,
      status: "active",
      title: card.title,
      subtitle: card.status,
      description: card.description,
      icon: card.icon,
      imageUrl: card.imageUrl,
      destinationUrl: card.destinationUrl,
      externalUrl: card.externalUrl,
      createdAt: card.startsAt || card.observedAt || now.toISOString(),
      updatedAt: card.observedAt,
      startsAt: card.startsAt,
      expiresAt: card.endsAt || newsExpiry(card, now),
      dismissible: card.priority !== "critical",
      autoDismiss: card.priority !== "critical",
      source: providerSource(card),
      sourceLabel: card.sourceLabel,
      sourceConfidence: card.sourceConfidence
    }));
}

async function cachedCards(
  env: Env,
  providerKey: string,
  ttlMs: number,
  loader: (env: Env, observedAt: string) => Promise<HappeningCard[]>,
  force: boolean
): Promise<CachedCards> {
  const now = new Date();
  const stored = await env.DB.prepare(
    "SELECT payload_json, observed_at, expires_at FROM world_state_snapshots WHERE provider_key = ?"
  ).bind(providerKey).first<SnapshotRow>();
  const parsed = parseSnapshot(stored);
  if (!force && parsed && Date.parse(stored!.expires_at) > now.getTime()) return parsed;
  try {
    const observedAt = now.toISOString();
    const cards = await loader(env, observedAt);
    const payload: CachedCards = { cards, observedAt };
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO world_state_snapshots (provider_key, payload_json, observed_at, expires_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(provider_key) DO UPDATE SET payload_json = excluded.payload_json,
          observed_at = excluded.observed_at, expires_at = excluded.expires_at
      `).bind(providerKey, JSON.stringify(payload), observedAt, new Date(now.getTime() + ttlMs).toISOString()),
      env.DB.prepare(`
        INSERT INTO world_provider_status (provider_key, state, last_attempt_at, last_success_at, error_code, error_message)
        VALUES (?, 'live', ?, ?, NULL, NULL)
        ON CONFLICT(provider_key) DO UPDATE SET state = excluded.state,
          last_attempt_at = excluded.last_attempt_at, last_success_at = excluded.last_success_at,
          error_code = NULL, error_message = NULL
      `).bind(providerKey, observedAt, observedAt)
    ]);
    return payload;
  } catch (error: any) {
    const attemptedAt = now.toISOString();
    await env.DB.prepare(`
      INSERT INTO world_provider_status (provider_key, state, last_attempt_at, last_success_at, error_code, error_message)
      VALUES (?, 'unavailable', ?, NULL, ?, ?)
      ON CONFLICT(provider_key) DO UPDATE SET state = excluded.state,
        last_attempt_at = excluded.last_attempt_at, error_code = excluded.error_code,
        error_message = excluded.error_message
    `).bind(providerKey, attemptedAt, safeErrorCode(error), safeErrorMessage(error)).run();
    if (parsed) {
      return {
        ...parsed,
        cards: parsed.cards.map((card) => ({
          ...card,
          state: "stale",
          sourceConfidence: card.sourceConfidence === "confirmed" ? "observed" : card.sourceConfidence
        }))
      };
    }
    return {
      observedAt: attemptedAt,
      cards: [providerUnavailableCard(providerKey, attemptedAt)]
    };
  }
}

async function loadMilestoneCards(env: Env, observedAt: string): Promise<HappeningCard[]> {
  const [milestones, activityManifest, questManifest] = await Promise.all([
    bungieGet("/Destiny2/Milestones/", env),
    loadActivityManifest(env),
    loadQuestManifest(env)
  ]);
  return normalizePublicMilestones(milestones, {
    ...activityManifest,
    itemDefinitions: { ...questManifest.itemDefinitions, ...activityManifest.itemDefinitions },
    objectiveDefinitions: { ...questManifest.objectiveDefinitions, ...activityManifest.objectiveDefinitions }
  }, observedAt);
}

async function loadAlertCards(env: Env, observedAt: string): Promise<HappeningCard[]> {
  const alerts = await bungieGet("/GlobalAlerts/?includestreaming=false", env);
  return normalizeGlobalAlerts(alerts, observedAt);
}

async function loadNewsCards(env: Env, observedAt: string): Promise<HappeningCard[]> {
  const feed = await bungieGet("/Content/Rss/NewsArticles/0/?categoryfilter=destiny&includebody=false", env);
  return normalizeBungieNews(feed, observedAt);
}

export function normalizePublicMilestones(
  response: unknown,
  manifest: CompactManifest,
  observedAt: string
): HappeningCard[] {
  const now = Date.parse(observedAt);
  const milestones = Object.values(asRecord(response));
  const output: HappeningCard[] = [];
  for (const raw of milestones) {
    const milestone = asRecord(raw);
    const milestoneHash = text(milestone.milestoneHash);
    if (!milestoneHash) continue;
    const milestoneDefinition = asRecord(manifest.milestoneDefinitions?.[milestoneHash]);
    const milestoneName = displayName(milestoneDefinition) || text(milestoneDefinition.friendlyName);
    const start = validDate(milestone.startDate);
    const end = validDate(milestone.endDate);
    if (start && Date.parse(start) > now) continue;
    if (end && Date.parse(end) <= now) continue;
    const activityHashes = collectHashes(milestone, "activityHash");
    const questHashes = collectHashes(milestone, "questItemHash");
    const modifierNames = collectArrayHashes(milestone, "modifierHashes")
      .map((hash) => displayName(asRecord(manifest.activityModifierDefinitions?.[hash])))
      .filter(Boolean)
      .filter((name, index, entries) => entries.indexOf(name) === index)
      .slice(0, 4);
    const candidates = [
      ...activityHashes.map((hash) => ({ hash, definition: asRecord(manifest.activityDefinitions[hash]) })),
      ...questHashes.map((hash) => ({ hash, definition: asRecord(manifest.itemDefinitions[hash]) }))
    ].filter((entry) => displayName(entry.definition));
    const classified = new Map<string, { classification: ActivityClassification; hash: string; definition: Record<string, unknown> }>();
    for (const candidate of candidates) {
      const name = displayName(candidate.definition);
      const description = displayDescription(candidate.definition);
      const activityTypeHash = text(candidate.definition.activityTypeHash);
      const classification = classifyActivity(`${milestoneName || ""} ${name} ${description}`, activityTypeHash || "");
      if (!classification) continue;
      const current = classified.get(classification.key);
      if (!current || preferredDefinition(candidate.definition, current.definition)) {
        classified.set(classification.key, { classification, ...candidate });
      }
    }
    if (!classified.size && milestoneName) {
      const classification = classifyActivity(milestoneName, "");
      if (classification) classified.set(classification.key, { classification, hash: milestoneHash, definition: milestoneDefinition });
    }
    for (const { classification, hash, definition } of classified.values()) {
      const name = displayName(definition) || milestoneName || classification.label;
      const baseDescription = displayDescription(definition) || displayDescription(milestoneDefinition);
      const modifierSummary = modifierNames.length ? `Modifiers: ${modifierNames.join(", ")}.` : "";
      const description = compactDescription([baseDescription, modifierSummary].filter(Boolean).join(" "));
      const state = end && Date.parse(end) - now <= 6 * 60 * 60_000 ? "ending-soon" : "live";
      output.push({
        id: `milestone:${classification.key}:${milestoneHash}:${hash}`,
        section: classification.section,
        category: classification.category,
        priority: state === "ending-soon" ? "high" : classification.priority,
        state,
        title: activityTitle(classification, name, milestoneName),
        status: end || "Available now",
        description,
        icon: definitionIcon(definition),
        startsAt: start,
        endsAt: end,
        destinationUrl: "/whats-happening",
        sourceLabel: "Bungie public milestones",
        sourceConfidence: "live-api",
        observedAt
      });
    }
  }
  return collapseRepeatedActivities(deduplicateCards(output)).slice(0, 18);
}

export function normalizeBungieNews(response: unknown, observedAt: string): HappeningCard[] {
  const value = asRecord(response);
  const articles = Array.isArray(value.NewsArticles) ? value.NewsArticles : Array.isArray(value.newsArticles) ? value.newsArticles : [];
  return articles.flatMap((raw, index): HappeningCard[] => {
    const article = asRecord(raw);
    const title = text(article.Title) || text(article.title);
    const publishedAt = validDate(article.PubDate || article.pubDate);
    const link = absoluteBungieUrl(text(article.Link) || text(article.link));
    if (!title || !publishedAt || !link || Date.parse(observedAt) - Date.parse(publishedAt) > 45 * 86_400_000) return [];
    const maintenance = /maintenance|service alert|downtime|server status/i.test(title);
    return [{
      id: `news:${text(article.UniqueIdentifier) || slug(title)}`,
      section: maintenance ? "upcoming" : "news",
      category: maintenance ? "warning" : "bungie-news",
      priority: maintenance ? "high" : index === 0 ? "normal" : "low",
      state: maintenance ? "upcoming" : "live",
      title,
      status: maintenance ? "Official maintenance information" : "Official Bungie article",
      description: compactDescription(stripHtml(text(article.Description) || text(article.description))),
      imageUrl: absoluteBungieUrl(text(article.ImagePath) || text(article.imagePath)),
      externalUrl: link,
      sourceLabel: "Bungie.net",
      sourceConfidence: "confirmed",
      observedAt: publishedAt
    }];
  }).slice(0, 4);
}

export function normalizeGlobalAlerts(response: unknown, observedAt: string): HappeningCard[] {
  const alerts = Array.isArray(response) ? response : [];
  return alerts.flatMap((raw, index): HappeningCard[] => {
    const alert = asRecord(raw);
    const message = compactDescription(stripHtml(text(alert.AlertHtml) || text(alert.alertHtml)), 280);
    if (!message) return [];
    const level = Number(alert.AlertLevel ?? alert.alertLevel ?? 0);
    const critical = level >= 3 || /offline|outage|unavailable|emergency/i.test(message);
    const timestamp = validDate(alert.AlertTimestamp || alert.alertTimestamp) || observedAt;
    return [{
      id: `alert:${text(alert.AlertKey) || slug(message.slice(0, 80)) || index}`,
      section: "live",
      category: critical ? "outage" : "warning",
      priority: critical ? "critical" : "high",
      state: "live",
      title: critical ? "Destiny service alert" : "Bungie service notice",
      status: critical ? "Service interruption" : "Active notice",
      description: message,
      externalUrl: absoluteBungieUrl(text(alert.AlertLink) || text(alert.alertLink)),
      sourceLabel: "Bungie global alerts",
      sourceConfidence: "confirmed",
      observedAt: timestamp
    }];
  });
}

function classifyActivity(value: string, activityTypeHash: string): ActivityClassification | undefined {
  const textValue = value.toLowerCase();
  if (/trials of osiris|\btrials\b/.test(textValue)) return { key: "trials", label: "Trials", section: "live", category: "trials", priority: "high" };
  if (/iron banner/.test(textValue)) return { key: "iron-banner", label: "Iron Banner", section: "live", category: "iron-banner", priority: "high" };
  if (/guardian games|festival of the lost|the dawning|\bsolstice\b|community event/.test(textValue)) return { key: "live-event", label: "Live event", section: "live", category: "seasonal", priority: "high" };
  if (/grandmaster/.test(textValue)) return { key: "grandmaster", label: "Grandmaster", section: "weekly", category: "vanguard", priority: "normal" };
  if (/nightfall|the ordeal/.test(textValue) || activityTypeHash === "575572995") return { key: "nightfall", label: "Nightfall", section: "weekly", category: "vanguard", priority: "normal" };
  if (/legendary lost sector|\blost sector\b/.test(textValue)) return { key: "lost-sector", label: "Lost Sector", section: "daily", category: "legendary", priority: "normal" };
  if (/weekly campaign mission|campaign weekly|featured campaign/.test(textValue)) return { key: "campaign", label: "Campaign mission", section: "weekly", category: "seasonal", priority: "normal" };
  if (/crucible labs|competitive division|competitive playlist/.test(textValue)) return { key: "crucible-rotation", label: "Crucible", section: "weekly", category: "crucible", priority: "normal" };
  if (/pantheon/.test(textValue)) return { key: "pantheon", label: "Pantheon", section: "weekly", category: "legendary", priority: "normal" };
  if (/\braid\b|featured raid|raid rotator/.test(textValue) || activityTypeHash === "2043403989") return { key: "raid", label: "Raid", section: "weekly", category: "legendary", priority: "normal" };
  if (/\bdungeon\b|featured dungeon|dungeon rotator/.test(textValue) || activityTypeHash === "608898761") return { key: "dungeon", label: "Dungeon", section: "weekly", category: "legendary", priority: "normal" };
  if (/exotic mission|exotic rotator/.test(textValue)) return { key: "exotic-mission", label: "Exotic mission", section: "weekly", category: "exotic", priority: "normal" };
  return undefined;
}

function activityTitle(classification: ActivityClassification, name: string, milestoneName?: string): string {
  if (name.toLowerCase().includes(classification.label.toLowerCase())) return name;
  const featured = /featured|rotator/i.test(`${milestoneName || ""} ${name}`) ? "Featured " : "";
  return `${featured}${classification.label} · ${name}`;
}

function preferredDefinition(next: Record<string, unknown>, current: Record<string, unknown>): boolean {
  const nextName = displayName(next);
  const currentName = displayName(current);
  const difficulty = /adept|advanced|expert|master|legend|normal|matchmade|private|customize/i;
  return Number(!difficulty.test(nextName)) > Number(!difficulty.test(currentName))
    || (Number(!difficulty.test(nextName)) === Number(!difficulty.test(currentName)) && nextName.length < currentName.length);
}

function deduplicateCards(cards: HappeningCard[]): HappeningCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = `${card.category}:${card.title.toLowerCase().replace(/\b(adept|advanced|expert|master|legend|normal|matchmade|private|customize)\b/g, "").replace(/\W+/g, " ").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collapseRepeatedActivities(cards: HappeningCard[]): HappeningCard[] {
  return ["raid", "dungeon"].reduce((current, kind) => {
    const prefix = `milestone:${kind}:`;
    const matching = current.filter((card) => card.id.startsWith(prefix));
    if (matching.length <= 2) return current;
    const names = matching
      .map((card) => card.title.replace(/^[^·]+·\s*/, "").replace(/:\s*Standard$/i, ""))
      .filter((name, index, entries) => entries.indexOf(name) === index);
    const first = matching[0]!;
    const endsAt = matching.map((card) => card.endsAt).filter(Boolean).sort()[0];
    const summary: HappeningCard = {
      ...first,
      id: `${prefix}summary`,
      title: `${kind === "raid" ? "Raid" : "Dungeon"} challenge rotations`,
      status: endsAt || `${matching.length} active rotations`,
      description: `${matching.length} active ${kind} rotations reported: ${summarizeNames(names)}.`,
      icon: undefined,
      endsAt
    };
    return [...current.filter((card) => !card.id.startsWith(prefix)), summary];
  }, cards);
}

function summarizeNames(names: string[]): string {
  const visible = names.slice(0, 6);
  const remaining = names.length - visible.length;
  return `${visible.join(", ")}${remaining > 0 ? `, and ${remaining} more` : ""}`;
}

function collectHashes(value: unknown, wantedKey: string, depth = 0, output = new Set<string>()): string[] {
  if (depth > 8 || value === null || value === undefined) return [...output];
  if (Array.isArray(value)) {
    value.forEach((entry) => collectHashes(entry, wantedKey, depth + 1, output));
    return [...output];
  }
  if (typeof value !== "object") return [...output];
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === wantedKey) {
      const hash = text(entry);
      if (hash && hash !== "0") output.add(hash);
    } else {
      collectHashes(entry, wantedKey, depth + 1, output);
    }
  }
  return [...output];
}

function collectArrayHashes(value: unknown, wantedKey: string, depth = 0, output = new Set<string>()): string[] {
  if (depth > 8 || value === null || value === undefined) return [...output];
  if (Array.isArray(value)) {
    value.forEach((entry) => collectArrayHashes(entry, wantedKey, depth + 1, output));
    return [...output];
  }
  if (typeof value !== "object") return [...output];
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === wantedKey && Array.isArray(entry)) {
      entry.forEach((hash) => {
        const normalized = text(hash);
        if (normalized && normalized !== "0") output.add(normalized);
      });
    } else {
      collectArrayHashes(entry, wantedKey, depth + 1, output);
    }
  }
  return [...output];
}

function providerUnavailableCard(providerKey: string, observedAt: string): HappeningCard {
  const definitions = {
    "public-milestones": ["Activity rotations unavailable", "Bungie public milestones"],
    "bungie-global-alerts": ["Service-alert source unavailable", "Bungie global alerts"],
    "bungie-news": ["Bungie news unavailable", "Bungie.net news"]
  } as const;
  const [title, sourceLabel] = definitions[providerKey as keyof typeof definitions] || ["World-state source unavailable", "Guardian Nexus"];
  return {
    id: `provider-unavailable:${providerKey}`,
    section: providerKey === "bungie-news" ? "news" : "live",
    category: "outage",
    priority: providerKey === "public-milestones" ? "high" : "normal",
    state: "unavailable",
    title,
    status: "No current data",
    description: "The rest of the dashboard remains available. Guardian Nexus will retry this source automatically.",
    sourceLabel,
    sourceConfidence: "unavailable",
    observedAt
  };
}

function parseSnapshot(row: SnapshotRow | null): CachedCards | undefined {
  if (!row) return undefined;
  try {
    const value = JSON.parse(row.payload_json) as CachedCards;
    return Array.isArray(value.cards) && typeof value.observedAt === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function displayName(definition: Record<string, unknown>): string {
  return text(asRecord(definition.displayProperties).name) || "";
}

function displayDescription(definition: Record<string, unknown>): string {
  return text(asRecord(definition.displayProperties).description) || "";
}

function definitionIcon(definition: Record<string, unknown>): string | undefined {
  const icon = text(asRecord(definition.displayProperties).icon);
  return icon ? imageUrl(icon) : undefined;
}

function validDate(value: unknown): string | undefined {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stripHtml(value?: string): string | undefined {
  return value?.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim();
}

function compactDescription(value?: string, max = 220): string | undefined {
  if (!value) return undefined;
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1).trimEnd()}…`;
}

function absoluteBungieUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, BUNGIE_NEWS_ROOT).toString();
  } catch {
    return undefined;
  }
}

function safeErrorCode(error: any): string {
  return String(error?.code || "provider_failed").slice(0, 80);
}

function safeErrorMessage(error: any): string {
  return String(error?.message || "Provider request failed.").replace(/[\r\n]+/g, " ").slice(0, 240);
}

function providerSource(card: HappeningCard): string {
  if (card.sourceLabel === "Bungie public milestones") return "bungie-public-milestones";
  if (card.sourceLabel === "Bungie global alerts") return "bungie-global-alerts";
  if (card.sourceLabel === "Bungie.net") return "bungie-news";
  return "guardian-nexus-world-state";
}

function newsExpiry(card: HappeningCard, now: Date): string | undefined {
  return card.section === "news" ? new Date(Date.parse(card.observedAt || now.toISOString()) + 30 * 86_400_000).toISOString() : undefined;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
